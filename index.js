#!/usr/bin/env node

require('dotenv').config()

const FormData = require('form-data')
const path = require('path')
const { globSource } = require('ipfs-http-client')
const axios = require('axios')
const { isModuleNamespaceObject } = require('util/types')
const CID = require('cids')

const { IPFS_CLUSTER_HOST, IPFS_CLUSTER_USER, IPFS_CLUSTER_PASS } = process.env

async function getDirFormData (dir, hidden = false) {
  const data = new FormData()

  for await (const file of globSource(dir, { recursive: true, hidden })) {
    if (file.content) {
      data.append('file', file.content, {
        filepath: path.normalize(file.path)
      })
    }
  }
  return data
}

async function pinDir (dir, { tag } = {}) {
  const data = await getDirFormData(dir)

  const res = await axios.post(`${IPFS_CLUSTER_HOST}/add?name=${tag}`, data, {
    maxContentLength: Infinity,
    maxBodyLength: Infinity,
    headers: {
      'Content-Type': `multipart/form-data; boundary=${data.getBoundary()}`,
      'Authorization': `Basic ${Buffer.from(`${IPFS_CLUSTER_USER}:${IPFS_CLUSTER_PASS}`).toString('base64')}`
    }
  })
    const results = res.data
    .trim()
    .split('\n')
    .map(JSON.parse)

  const basename = path.basename(dir)
  const root = results.find(({ name }) => name === basename)

  if (!root) {
    throw new Error('could not determine the CID')
  }

  return {
    cidv0: root.cid,
    cidv1: new CID(root.cid).toV1().toString('base32')
  }
}


async function run () {
  const source = process.argv[2]
  const tag = process.argv[3]

  if (!source) {
    console.log('Add source dir!')
    process.exit(1)
  }
  const result = await pinDir(source, { tag })
  console.log(`Done. Pinned successfully.\n` + 
    `-----------------------------------\n` + 
    `CIDv0: ${result.cidv0}\n` + 
    `CIDv1: ${result.cidv1}\n` +
    `Gateway URL: https://${result.cidv1}.ipfs.gwei.cz\n` +
    `-----------------------------------`
  )
}

run()
