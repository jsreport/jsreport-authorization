const should = require('should')
const jsreport = require('jsreport-core')
const createRequest = require('jsreport-core/lib/render/request')

describe('authorization', () => {
  let reporter

  beforeEach(() => {
    reporter = jsreport()
    reporter.use(require('../')())
    reporter.use(require('jsreport-templates')())
    reporter.use((reporter, definition) => {
      // auth fake
      reporter.authentication = {}
      reporter.documentStore.model.entityTypes['UserType'] = {}
    })
    return reporter.init()
  })

  function createTemplate (req) {
    return reporter.documentStore.collection('templates').insert({content: 'foo', name: 'foo', engine: 'none', recipe: 'html'}, req)
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
    return reporter.documentStore.collection('templates')
      .update({}, { $set: { content: 'hello' } }, req2)
      .should.be.rejectedWith(/Unauthorized/)
  })

  it('user without permission should not be able to remove entity', async () => {
    await createTemplate(req1)
    return reporter.documentStore.collection('templates')
      .remove({}, req2)
      .should.be.rejectedWith(/Unauthorized/)
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

  it('user with readAllPermissions should be able to read all entities', async () => {
    await createTemplate(req1)
    const count = await countTemplates(createRequest({ context: { user: { _id: 'foo', readAllPermissions: true } } }))
    count.should.be.eql(1)
  })

  it('user with editAllPermissions should be able to update entities', async () => {
    await createTemplate(req1)
    const req = createRequest({ context: { user: { _id: 'foo', editAllPermissions: true } } })
    await reporter.documentStore.collection('templates').update({}, { $set: { content: 'hello' } }, req)
  })

  it('user with permissions to the folder should have access also to the entities inside the folder', async () => {
    await reporter.documentStore.collection('folders').insert({
      name: 'folder',
      shortid: 'folder',
      readPermissions: [req2.context.user._id]
    }, req1)

    await reporter.documentStore.collection('templates').insert({
      name: 'template',
      engine: 'none',
      content: 'foo',
      recipe: 'html',
      folder: {
        shortid: 'folder'
      }
    }, req1)

    const count = await countTemplates(req2)
    count.should.be.eql(1)
  })

  it('user should not be able to create entities in folders where he has no permissions', async () => {
    await reporter.documentStore.collection('folders').insert({
      name: 'folder',
      shortid: 'folder'
    }, req1)

    return reporter.documentStore.collection('folders').insert({
      name: 'nested',
      shortid: 'nested',
      folder: { shortid: 'folder' }
    }, req2).should.be.rejected()
  })

  it('user should be able to create entities in folders where he has permissions', async () => {
    await reporter.documentStore.collection('folders').insert({
      name: 'folder',
      shortid: 'folder',
      editPermissions: [req2.context.user._id]
    }, req1)

    return reporter.documentStore.collection('folders').insert({
      name: 'nested',
      shortid: 'nested',
      folder: { shortid: 'folder' }
    }, req2)
  })

  it('user should not be able to update entities in folders where he has no permissions', async () => {
    await reporter.documentStore.collection('folders').insert({
      name: 'folder',
      shortid: 'folder'
    }, req1)

    await reporter.documentStore.collection('templates').insert({
      name: 'template',
      engine: 'none',
      recipe: 'html',
      content: 'foo',
      folder: { shortid: 'folder' }
    }, req1)

    return reporter.documentStore.collection('templates').update({
      name: 'template'
    }, {
      $set: { content: 'change' }
    }, req2).should.be.rejected()
  })

  it('user should be able to update entities in folders where he has permissions', async () => {
    await reporter.documentStore.collection('folders').insert({
      name: 'folder',
      shortid: 'folder',
      editPermissions: [req2.context.user._id],
      readPermissions: [req2.context.user._id]
    }, req1)

    await reporter.documentStore.collection('templates').insert({
      name: 'template',
      engine: 'none',
      recipe: 'html',
      content: 'foo',
      folder: { shortid: 'folder' }
    }, req2)

    return reporter.documentStore.collection('templates').update({
      name: 'template'
    }, {
      $set: { content: 'change' }
    }, req1)
  })

  it('user should not be able to remove entities in folders where he has no permissions', async () => {
    await reporter.documentStore.collection('folders').insert({
      name: 'folder',
      shortid: 'folder'
    }, req1)

    await reporter.documentStore.collection('templates').insert({
      name: 'template',
      engine: 'none',
      recipe: 'html',
      content: 'foo',
      folder: { shortid: 'folder' }
    }, req1)

    return reporter.documentStore.collection('templates').remove({
      name: 'template'
    }, req2).should.be.rejected()
  })

  it('user should be able to remove entities in folders where he has permissions', async () => {
    await reporter.documentStore.collection('folders').insert({
      name: 'folder',
      shortid: 'folder',
      editPermissions: [req2.context.user._id]
    }, req1)

    await reporter.documentStore.collection('templates').insert({
      name: 'template',
      engine: 'none',
      recipe: 'html',
      content: 'foo',
      folder: { shortid: 'folder' }
    }, req1)

    return reporter.documentStore.collection('templates').remove({
      name: 'template'
    }, req2)
  })
})
