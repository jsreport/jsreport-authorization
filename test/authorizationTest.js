const should = require('should')
const jsreport = require('jsreport-core')
const createRequest = require('jsreport-core/lib/render/request')

describe('authorization', () => {
  let reporter

  beforeEach(() => {
    reporter = jsreport()
    reporter.use(require('../')())
    reporter.use(require('jsreport-templates')())
    reporter.authentication = {}
    return reporter.init()
  })

  function createTemplate (req) {
    return reporter.documentStore.collection('templates').insert({content: 'foo'}, req)
  }

  async function countTemplates (req) {
    const res = await reporter.documentStore.collection('templates').find({}, req)
    return res.length
  }

  const req1 = createRequest({ context: { user: { _id: 'NTRiZTU1MTFiY2NkNmYzYzI3OTdiNjYz' } } })
  const req2 = createRequest({ context: { user: { _id: 'NTRiZTVhMzU5ZDI4ZmU1ODFjMTI4MjMy' } } })

  it('user creating entity should be able to read it', async () => {
    await createTemplate(req1)
    const count = await countTemplates(req1)
    count.should.be.eql(1)
  })

  it('user should not be able to read entity without permission to it', async () => {
    await createTemplate(req1)
    const count = await countTemplates(req2)
    count.should.be.eql(0)
  })

  it('query should filter out entities without permissions', async () => {
    await createTemplate(req1)
    await createTemplate(req2)
    const count = await countTemplates(req1)
    count.should.be.eql(1)
  })

  it('user creating entity should be able to update it', async () => {
    await createTemplate(req1)
    await reporter.documentStore.collection('templates').update({}, { $set: { content: 'hello' } }, req1)
    const templates = await reporter.documentStore.collection('templates').find({}, req1)
    templates[0].content.should.be.eql('hello')
  })

  it('user creating entity should be able to remove it', async () => {
    await createTemplate(req1)
    await reporter.documentStore.collection('templates').update({}, { $set: { content: 'hello' } }, req1)
    await reporter.documentStore.collection('templates').remove({}, req1)
    const count = await countTemplates(req1)
    count.should.be.eql(0)
  })

  it('user without permission should not be able to update entity', async () => {
    await createTemplate(req1)
    try {
      await reporter.documentStore.collection('templates').update({}, { $set: { content: 'hello' } }, req2)
      throw new Error('Should have faied')
    } catch (e) {
      e.message.should.containEql('Unauthorized')
    }
  })

  it('user without permission should not be able to remove entity', async () => {
    await createTemplate(req1)
    try {
      await reporter.documentStore.collection('templates').remove({}, req2)
      throw new Error('Should have faied')
    } catch (e) {
      e.message.should.containEql('Unauthorized')
    }
  })

  it('admin user should be able to remove entity even without permission', async () => {
    await createTemplate(req1)
    await reporter.documentStore.collection('templates').remove({}, createRequest({ context: { user: { isAdmin: true } } }))
    const count = await countTemplates(req1)
    count.should.be.eql(0)
  })

  it('admin user should be able to update entity even without permission', async () => {
    await createTemplate(req1)
    await reporter.documentStore.collection('templates').update({}, { $set: { content: 'hello' } }, createRequest({ context: { user: { isAdmin: true } } }))
    const templates = await reporter.documentStore.collection('templates').find({}, req1)
    templates[0].content.should.be.eql('hello')
  })

  it('authorizeRequest should return false when user is not authorized', async () => {
    const requestAuth = await reporter.authorization.authorizeRequest({ context: { } })
    should(requestAuth).not.be.ok()
  })

  it('authorizeRequest should return true when user is authorized', async () => {
    const requestAuth = await reporter.authorization.authorizeRequest(req1)
    should(requestAuth).be.ok()
  })
})
