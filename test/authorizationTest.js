require('should')
var path = require('path')
var domain = require('domain')
var Reporter = require('jsreport-core').Reporter

describe('authorization', function () {
  var reporter

  beforeEach(function (done) {
    reporter = new Reporter({
      rootDirectory: path.join(__dirname, '../')
    })

    reporter.authentication = {}
    reporter.init().then(function () {
      process.domain = process.domain || domain.create()
      process.domain.req = {}
      done()
    }).fail(done)
  })

  function runInUserDomain (id, fn) {
    var d = require('domain').create()
    d.req = {user: {_id: id}}

    d.run(fn)
  }

  function createTemplate (userId, done, error) {
    runInUserDomain(userId, function () {
      return reporter.documentStore.collection('templates').insert({content: 'foo'}).then(function () {
        done()
      }).catch(error)
    })
  }

  function countTemplates (userId, done, error) {
    runInUserDomain(userId, function () {
      return reporter.documentStore.collection('templates').find({}).then(function (res) {
        done(res.length)
      }).catch(error)
    })
  }

  var userId1 = 'NTRiZTU1MTFiY2NkNmYzYzI3OTdiNjYz'
  var userId2 = 'NTRiZTVhMzU5ZDI4ZmU1ODFjMTI4MjMy'

  it('user creating entity should be able to read it', function (done) {
    createTemplate(userId1, function () {
      countTemplates(userId1, function (count) {
        count.should.be.eql(1)
        done()
      }, done)
    }, done)
  })

  it('user should not be able to read entity without permission to it', function (done) {
    createTemplate(userId1, function () {
      console.log('counting templtates')
      countTemplates(userId2, function (count) {
        count.should.be.eql(0)
        done()
      }, done)
    }, done)
  })

  it('query should filter out entities without permissions', function (done) {
    createTemplate(userId1, function () {
      createTemplate(userId2, function () {
        countTemplates(userId1, function (count) {
          count.should.be.eql(1)
          done()
        }, done)
      }, done)
    }, done)
  })
})
