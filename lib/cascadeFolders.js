async function collectEntitiesInHierarchy (reporter, items, sourceEntity, req) {
  if (sourceEntity.__entitySet === 'folders') {
    items.push(sourceEntity)

    let oneLevelItems = []
    for (const es in reporter.documentStore.model.entitySets) {
      let entities = await reporter.documentStore.collection(es).find({
        folder: {
          shortid: sourceEntity.shortid
        }
      }, req)

      entities.map((e) => ({...e, __entitySet: es, folder: sourceEntity})).forEach(e => oneLevelItems.push(e))
    }

    oneLevelItems.filter(e => e.__entitySet !== 'folders').forEach(e => items.push(e))
    await Promise.all(oneLevelItems.filter(e => e.__entitySet === 'folders').map(e => collectEntitiesInHierarchy(reporter, items, e, req)))
  } else {
    items.push(sourceEntity)
  }
}

function mergeArrays (arrayA = [], arrayB = [], arrayC = []) {
  return [...new Set([...arrayA, ...arrayB, ...arrayC])]
}

module.exports = (reporter) => {
  reporter.initializeListeners.add('authorization-cascade', () => {
    for (const key in reporter.documentStore.collections) {
      const col = reporter.documentStore.collections[key]

      if (reporter.documentStore.model.entitySets[col.entitySet].shared) {
        continue
      }

      col.beforeInsertListeners.add('authorization-insert-cascade', async (doc, req) => {
        if (!doc.folder) {
          return
        }

        const folder = await reporter.documentStore.collection('folders').findOne({
          shortid: doc.folder.shortid
        }, req)

        doc.inheritedReadPermissions = mergeArrays(doc.inheritedReadPermissions, folder.readPermissions, folder.inheritedReadPermissions)
        doc.inheritedEditPermissions = mergeArrays(doc.inheritedEditPermissions, folder.editPermissions, folder.inheritedEditPermissions)
      })

      col.beforeUpdateListeners.add('authorization-cascade-update', async (q, u, options, req) => {
        if (!req || req.context.skipPermissionsCascade) {
          return
        }

        if (u.$set.folder === undefined && (key !== 'folders' || (!u.$set.readPermissions && !u.$set.editPermissions))) {
          return
        }

        req.context.skipPermissionsCascade = true

        const entityBeingUpdated = await reporter.documentStore.collection(key).findOne(q, req)

        if (!entityBeingUpdated) {
          return
        }

        Object.assign(entityBeingUpdated, { __entitySet: key, ...u.$set })
        if (entityBeingUpdated.folder) {
          entityBeingUpdated.folder = await reporter.documentStore.collection('folders').findOne({ shortid: entityBeingUpdated.folder.shortid }, req)
        }

        const items = []
        await collectEntitiesInHierarchy(reporter, items, entityBeingUpdated, req)

        items.forEach((i) => {
          if (!i.folder) {
            i.inheritedReadPermissions = []
            i.inheritedEditPermissions = []
          } else {
            i.inheritedReadPermissions = mergeArrays(i.folder.readPermissions, i.folder.inheritedReadPermissions)
            i.inheritedEditPermissions = mergeArrays(i.folder.editPermissions, i.folder.inheritedEditPermissions)
          }
        })

        for (const item of items) {
          await reporter.documentStore.collection(item.__entitySet).update({
            _id: item._id
          }, {
            $set: {
              inheritedReadPermissions: item.inheritedReadPermissions,
              inheritedEditPermissions: item.inheritedEditPermissions
            }
          }, req)

          req.context.skipPermissionsCascade = false
        }
      })
    }
  })
}
