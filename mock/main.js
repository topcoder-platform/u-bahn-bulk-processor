const express = require('express')
const bodyParser = require('body-parser')

const app = express()
app.use(bodyParser.json())

app.get('/users', function (req, res) {
  console.log(`get user with parameters: ${JSON.stringify(req.query)}`)
  if (req.query.handle === 'user1') {
    res.send([{
      id: '9abf4747-9b5e-41dd-ad2c-0c0bc13fd78d',
      handle: 'user1',
      created: '2020-05-16T02:58:58.053Z',
      updated: '2020-05-16T02:58:58.053Z',
      createdBy: 'user',
      updatedBy: 'user'
    }])
  } else if (req.query.handle === 'user2') {
    res.send([{
      id: '9abf4747-9b5e-41dd-ad2c-0c0bc13fd78d',
      handle: 'user1',
      created: '2020-05-16T02:58:58.053Z',
      updated: '2020-05-16T02:58:58.053Z',
      createdBy: 'user',
      updatedBy: 'user'
    }, {
      id: 'af3b4e34-aaf0-4244-9cf0-76ecc16c09b2',
      handle: 'user1',
      created: '2020-05-16T02:58:58.053Z',
      updated: '2020-05-16T02:58:58.053Z',
      createdBy: 'user',
      updatedBy: 'user'
    }])
  } else {
    res.send([])
  }
})

app.post('/users', function (req, res) {
  console.log(`create user: ${JSON.stringify(req.body)}`)
  res.send([{
    id: 'af3b4e34-aaf0-4244-9cf0-76ecc16c09b2',
    handle: req.query.handle,
    created: '2020-05-16T02:58:58.053Z',
    updated: '2020-05-16T02:58:58.053Z',
    createdBy: 'user',
    updatedBy: 'user'
  }])
})

app.get('/skillsProviders', function (req, res) {
  console.log(`get skill provider with parameters: ${JSON.stringify(req.query)}`)
  res.send([{
    id: 'e0b68be1-5de1-4b4c-b8b3-60e8cf98643f',
    name: req.query.name,
    created: '2020-05-16T02:58:58.053Z',
    updated: '2020-05-16T02:58:58.053Z',
    createdBy: 'user',
    updatedBy: 'user'
  }])
})

app.get('/skills', function (req, res) {
  console.log(`get skill with parameters: ${JSON.stringify(req.query)}`)
  res.send([{
    id: '535a2ec2-57ea-4354-8715-beaf5a9f081b',
    skillProviderId: req.query.skillProviderId,
    name: req.query.name,
    externalId: 'f17a1b6b-f60a-471c-b0f6-b47c3d8ff557',
    uri: 'https://google.com',
    created: '2020-05-16T02:58:58.053Z',
    updated: '2020-05-16T02:58:58.053Z',
    createdBy: 'user',
    updatedBy: 'user'
  }])
})

app.post('/users/:userId/skills', function (req, res) {
  console.log(`create user skills: ${JSON.stringify(req.body)}`)
  res.send([{
    userId: req.params.userId,
    skillId: req.body.skillId,
    metricValue: req.body.metricValue,
    certifierId: req.body.certifierId,
    certifiedDate: req.body.certifiedDate,
    created: '2020-05-16T02:58:58.053Z',
    updated: '2020-05-16T02:58:58.053Z',
    createdBy: 'user',
    updatedBy: 'user'
  }])
})

app.get('/achievementsProviders', function (req, res) {
  console.log(`get achievement provider with parameters: ${JSON.stringify(req.query)}`)
  res.send([{
    id: '78d5da59-27f0-4153-9b82-057222a07f4b',
    name: req.query.name,
    created: '2020-05-16T02:58:58.053Z',
    updated: '2020-05-16T02:58:58.053Z',
    createdBy: 'user',
    updatedBy: 'user'
  }])
})

app.post('/users/:userId/achievements', function (req, res) {
  console.log(`create user achievement: ${JSON.stringify(req.body)}`)
  res.send([{
    userId: req.params.userId,
    achievementsProviderId: req.body.achievementsProviderId,
    name: req.body.name,
    uri: req.body.uri,
    certifierId: req.body.certifierId,
    certifiedDate: req.body.certifiedDate,
    created: '2020-05-16T02:58:58.053Z',
    updated: '2020-05-16T02:58:58.053Z',
    createdBy: 'user',
    updatedBy: 'user'
  }])
})

app.get('/attributeGroups', function (req, res) {
  console.log(`get attribute group with parameters: ${JSON.stringify(req.query)}`)
  res.send([{
    id: '3cb88e12-df55-40ee-bd5f-af94f3911746',
    name: req.query.name,
    organizationId: 'd59b3aff-8c13-4d84-83f6-a6d21e71db24',
    created: '2020-05-16T02:58:58.053Z',
    updated: '2020-05-16T02:58:58.053Z',
    createdBy: 'user',
    updatedBy: 'user'
  }])
})

app.get('/attributes', function (req, res) {
  console.log(`get attribute with parameters: ${JSON.stringify(req.query)}`)
  res.send([{
    id: '3cb88e12-df55-40ee-bd5f-af94f3911746',
    name: req.query.name,
    attributeGroupId: req.query.attributeGroupId,
    created: '2020-05-16T02:58:58.053Z',
    updated: '2020-05-16T02:58:58.053Z',
    createdBy: 'user',
    updatedBy: 'user'
  }])
})

app.post('/users/:userId/attributes', function (req, res) {
  console.log(`create user attribute: ${JSON.stringify(req.body)}`)
  res.send([{
    userId: req.params.userId,
    attributeId: req.body.attributeId,
    value: req.body.value,
    created: '2020-05-16T02:58:58.053Z',
    updated: '2020-05-16T02:58:58.053Z',
    createdBy: 'user',
    updatedBy: 'user'
  }])
})

app.patch('/uploads/:id', function (req, res) {
  console.log(`process upload file result: ${JSON.stringify(req.body)}`)
  res.send([{
    created: '2020-05-16T05:14:42.319Z',
    updated: '2020-05-16T05:14:42.319Z',
    createdBy: 0,
    updatedBy: 0,
    id: '1399a13d-eb4a-4cf2-98f6-74712d8b6569',
    url: 'https://google.com',
    status: req.body.status,
    info: req.body.info
  }])
})

app.listen(3001, function () {
  console.log('mock app listening on port 3001!')
})
