require('should')
var path = require('path')
var Reporter = require('jsreport-core').Reporter

describe('authorization', function () {
  var reporter

  beforeEach(function (done) {
    reporter = new Reporter({
      rootDirectory: path.join(__dirname, '../')
    })

    reporter.authentication = {}
    reporter.init().then(function () {
      done()
    }).fail(done)
  })

  function createTemplate (req, done, error) {
    return reporter.documentStore.collection('templates').insert({content: 'foo'}, req).then(function () {
      done()
    }).catch(error)
  }

  function countTemplates (req, done, error) {
    return reporter.documentStore.collection('templates').find({}, req).then(function (res) {
      done(res.length)
    }).catch(error)
  }

  var req1 = { user: { _id: 'NTRiZTU1MTFiY2NkNmYzYzI3OTdiNjYz' } }
  var req2 = { user: { _id: 'NTRiZTVhMzU5ZDI4ZmU1ODFjMTI4MjMy' } }

  it('user creating entity should be able to read it', function (done) {
    createTemplate(req1, function () {
      countTemplates(req1, function (count) {
        count.should.be.eql(1)
        done()
      }, done)
    }, done)
  })

  it('user should not be able to read entity without permission to it', function (done) {
    createTemplate(req1, function () {
      countTemplates(req2, function (count) {
        count.should.be.eql(0)
        done()
      }, done)
    }, done)
  })

  it('query should filter out entities without permissions', function (done) {
    createTemplate(req1, function () {
      createTemplate(req2, function () {
        countTemplates(req1, function (count) {
          count.should.be.eql(1)
          done()
        }, done)
      }, done)
    }, done)
  })
})
