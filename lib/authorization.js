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

  reporter.documentStore.model.entityTypes['UserType'].editAllPermissions = {type: 'Edm.Boolean'}
  reporter.documentStore.model.entityTypes['UserType'].readAllPermissions = {type: 'Edm.Boolean'}

  reporter.addRequestContextMetaConfig('skipAuthorization', { sandboxHidden: true })
  reporter.addRequestContextMetaConfig('skipAuthorizationForUpdate', { sandboxHidden: true })
  reporter.addRequestContextMetaConfig('skipAuthorizationForInsert', { sandboxHidden: true })
  reporter.addRequestContextMetaConfig('skipAuthorizationForQuery', { sandboxHidden: true })

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

  reporter.authorization.findPermissionFilteringListeners.add(definition.name, async (collection, query, req) => {
    // query should be extended with filtering of entities that has edit or read permissions for the particular user
    // additionally we need to extend filter for entities that are in folders particular user has permissions to and this must be recursive
    const q = req.context.skipAuthorizationForQuery = {
      $or: [{ readPermissions: req.context.user._id.toString() }, { editPermissions: req.context.user._id.toString() }]
    }
    const foldersWithPermissions = await reporter.documentStore.collection('folders').find(q, req)

    let allFoldersWithPermissions = [...foldersWithPermissions]
    async function getAllNestedFoldersWithPermissions (folders) {
      for (const f of folders) {
        const q = req.context.skipAuthorizationForQuery = { folder: { shortid: f.shortid } }
        const childFolders = await reporter.documentStore.collection('folders').find(q, req)
        allFoldersWithPermissions = allFoldersWithPermissions.concat(childFolders)
        await getAllNestedFoldersWithPermissions(childFolders)
      }
    }

    await getAllNestedFoldersWithPermissions(foldersWithPermissions)

    const filter = [
      { readPermissions: req.context.user._id.toString() },
      { editPermissions: req.context.user._id.toString() },
      ...allFoldersWithPermissions.map((f) => ({
        folder: { shortid: f.shortid }
      }))]

    if (!query.$or) {
      query.$or = filter
    } else {
      query.$and = [...query.$and, ...filter, ...(query.$or && query.$or)]
      delete query.$or
    }
  })

  reporter.initializeListeners.add(definition.name, () => {
    for (const key in reporter.documentStore.collections) {
      const col = reporter.documentStore.collections[key]

      if (reporter.documentStore.model.entitySets[col.entitySet].shared) {
        continue
      }

      assertPermissions(col, reporter)
      extendQueriesWithPermissions(col, reporter.authorization.findPermissionFilteringListeners)
    }
  })
}
