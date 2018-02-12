/*!
 * Copyright(c) 2018 Jan Blaha
 *
 * Extension for authorizing requests and data access. It is dependent on Authentication extension.
 *
 * Adds property readPermissions and editPermissions to every object as array od user ids identifying which
 * user can work on which object.
 */
const extendQueriesWithPermissions = require('./extendQueriesWithPermissions.js')
const assertPermissions = require('./assertPermissions.js')

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
    for (const key in reporter.documentStore.collections) {
      const col = reporter.documentStore.collections[key]

      if (reporter.documentStore.model.entitySets[col.entitySet].shared) {
        continue
      }

      assertPermissions(col, reporter.logger)
      extendQueriesWithPermissions(col, reporter.authorization.findPermissionFilteringListeners)
    }
  })
}
