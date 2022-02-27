#!/usr/bin/env node

const fs = require('fs')
const path = require('path')
const { chromium } = require('playwright')

const cfg = require('./config')

const options = {
  headless: false
}

function init() {
  fs.writeFileSync(cfg.result, '用户名,' + cfg.problems.join(',') + ',总分\n', err => {
    console.error(err)
  })
}

function write(name, scores) {
  const total = scores.reduce((sum, a) => sum + a, 0)
  fs.writeFileSync(cfg.result, `${name},` + scores.join(',') + `,${total}\n`, { flag: 'a+' }, err => {
    console.error(err)
  })
}

function find() {
  const files = fs.readdirSync(cfg.folder, { withFileTypes: true })
  return files.filter(f => f.isDirectory()).map(d => d.name)
}

async function finished(page, idx) {
  const waitings = ['pending', 'running']
  while(true) {
    await page.reload()
    const text = await page.locator(`table.view-table > tbody > tr:nth-child(${idx+1}) > td:nth-child(2)`).innerText()
    if (waitings.indexOf(text.toLowerCase()) >= 0) {
      await page.waitForTimeout(2000)
    } else {
      break
    }
  }
}

async function test(page, name, idx) {
  const file = path.join(cfg.folder, name, cfg.problems[idx], cfg.problems[idx] + '.cpp')
  try {
    const source = fs.readFileSync(file, 'utf8')
    await page.goto(`https://xjoi.net/contest/${cfg.contest}/problem/${idx+1}/submit`)
    await page.locator('select[name=language]').selectOption(cfg.language)
    await page.locator('textarea[name=source]').fill(source)
    await page.locator('button[type=submit]').click()
    await page.waitForSelector('text=当前状态')
    await finished(page, idx)
    return Number(await page.locator(`table.view-table > tbody > tr:nth-child(${idx+1}) > td:nth-child(3)`).innerText())
  } catch (error) {
    if (error.code !== 'ENOENT')
      console.error(error)
    return 0
  }
}

(async () => {
  init()

  const browser = await chromium.launch(options)
  const page = await browser.newPage()

  await page.goto('https://id.xjoi.net/login?clientId=c53638ead')
  await page.locator('#username').type(cfg.username)
  await page.locator('#password').type(cfg.password)
  await page.locator('button[type=submit]').click()
  await page.waitForSelector('text=团队')

  const names = find()
  for (const name of names) {
    const scores = []
    console.log(`testing for ${name}`)
    for (let i = 0; i < cfg.problems.length; i++) {
      scores.push(await test(page, name, i))
    }
    write(name, scores)
    await page.waitForTimeout(5000)
  }
  console.log('Done')

  await browser.close()
})()
