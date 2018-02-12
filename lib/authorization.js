/*!
 * Copyright(c) 2018 Jan Blaha
 *
 * Extension for authorizing requests and data access. It is dependent on Authentication extension.
 *
 * Adds property readPermissions and editPermissions to every object as array od user ids identifying which
 * user can work on which object.
 */
const Promise = require('bluebird')
const { authorizeUpdate, authorizeRemove, defaultAuth } = require('./helpers.js')
const authorizeCollections = require('./authorizeCollections')

function registerAuthorizationListeners (reporter) {
  for (const key in reporter.documentStore.collections) {
    const col = reporter.documentStore.collections[key]

    if (col.entitySet.shared) {
      continue
    }

    const check = async (collection, req, authAction) => {
      const fn = () => {
        if (!req) {
          return true
        }

        const defaultAuthResult = defaultAuth(collection, req)
        if (defaultAuthResult === true) {
          return true
        }
        if (defaultAuthResult === false) {
          return false
        }

        return authAction()
      }

      const res = await fn()
      if (res !== true) {
        if (req.context.user) {
          reporter.logger.warn('User ' + req.context.user.username + ' not authorized for ' + collection.entitySet)
        }

        const e = new Error('Unauthorized for ' + collection.entitySet)
        e.unauthorized = true
        throw e
      }
    }

    col.beforeUpdateListeners.add('authorization', col, (query, update, req) => {
      if (!req || req.skipAuthorizationForUpdate === query) {
        return
      }

      return check(col, req, () => authorizeUpdate(query, update, col, req))
    })

    col.beforeRemoveListeners.add('authorization', col, (query, req) => {
      return check(col, req, () => authorizeRemove(query, col, req))
    })

    col.beforeInsertListeners.add('authorization', col, (doc, req) => {
      if (!req || req.skipAuthorizationForInsert === doc) {
        return
      }
      return check(col, req, () => {
        return Promise.resolve(true)
      })
    })
  }
}

module.exports = function (reporter, definition) {
  if (!reporter.authentication) {
    definition.options.enabled = false
    return
  }

  reporter.documentStore.on('before-init', (documentStore) => {
    for (const key in documentStore.model.entitySets) {
      const entitySet = documentStore.model.entitySets[key]
      if (entitySet.shared) {
        continue
      }

      const entityType = documentStore.model.entityTypes[entitySet.entityType.replace(documentStore.model.namespace + '.', '')]

      entityType.readPermissions = {type: 'Collection(Edm.String)'}
      entityType.editPermissions = {type: 'Collection(Edm.String)'}
    }
  })

  reporter.authorization = {
    findPermissionFilteringListeners: reporter.createListenerCollection(),
    requestAuthorizationListeners: reporter.createListenerCollection(),
    operationAuthorizationListeners: reporter.createListenerCollection(),
    authorizeRequest: async function (req, res) {
      const authRes = await this.requestAuthorizationListeners.fireAndJoinResults(req, res)
      if (authRes === null) {
        return req.context.user !== null && req.context.user !== undefined
      }

      return authRes
    }
  }

  reporter.authorization.findPermissionFilteringListeners.add(definition.name, (collection, query, req) => {
    query.readPermissions = req.context.user._id.toString()
  })

  reporter.initializeListeners.add(definition.name, () => {
    registerAuthorizationListeners(reporter)
    authorizeCollections(reporter, reporter.authorization.findPermissionFilteringListeners)
  })
}
