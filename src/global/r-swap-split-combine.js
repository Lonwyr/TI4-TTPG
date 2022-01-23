/**
 * Press the R key on a relevant object (potentially with other selected 
 * objects) to swap, split, or combine.
 */
const {
    globalEvents, 
    world, 
    Vector, 
} = require('../wrapper/api')
const { Facing } = require('../lib/facing')
const assert = require('../wrapper/assert')
const { Player } = require('../mock/mock-player')

const METADATA_TO_INFO = {
    'unit:base/fighter' : { 
        name : 'fighter $COLOR',
        bag : 'bag.unit:base/fighter'
    },
    'token:base/fighter_1' : { name : 'fighter_x1' },
    'token:base/fighter_3' : { name : 'fighter_x3' },
    'unit:base/infantry' : { name : 'infantry $COLOR' },
    'token:base/infantry_1' : { name : 'infantry_x1' },
    'token:base/infantry_3' : { name : 'infantry_x3' },
    'token:base/tradegood_commodity_1' : { name : 'tg_x1' },
    'token:base/tradegood_commodity_3' : { name : 'tg_x3' },
}

const REPLACE_RULES = [
    {
        repeatable : true,
        consume : { count : 3, names : [ 'fighter_x1', 'fighter $COLOR' ] },
        produce : { count : 1, name : 'fighter_x3' }
    },
    {
        consume : { count : 1, name : 'fighter_x3' },
        produce : { count : 3, name : 'fighter_x1' }
    },
    {
        consume : { count : 1, name : 'fighter_x1' },
        produce : { count : 1, name : 'fighter $COLOR' }
    },
    {
        consume : { count : 1, name :  'fighter $COLOR' },
        produce : { count : 1, name : 'fighter_x1' }
    },

    // Preserve face up/down
    {
        repeatable : true,
        faceUp : true,
        consume : { count : 3, name : 'tg_x1' },
        produce : { count : 1, name : 'tg_x3' }
    },
    {
        faceDown : true,
        consume : { count : 1, name : 'tg_x3' },
        produce : { count : 3, name : 'tg_x1' }
    },    
]

function isInfiniteContainer(obj) {
    const infiniteTypes = [ 1, 3 ]
    return (obj instanceof Container) && infiniteTypes.includes(obj.getType())
}

/**
 * Get the bag to produce or consume this item type.
 * 
 * @param {string} nsid - namespace <type:source/name> id.
 * @param {number} playerSlot 
 * @returns 
 */
function getBag(nsid, playerSlot) {
    assert(typeof nsid === 'string')
    assert(typeof playerSlot === 'number')

    for (const obj of world.getAllObjects()) {
        if (!(obj instanceof Container)) {
            continue
        }

        if (isInfiniteContainer(obj)) {
            // Infinite bag.  Do not assume the bag follows nsid conventions
            // as infinite bags may share a template for different uses.
            // Instead, compare with the nsid of the first entry in the bag.
            const firstItem = obj.getItems()[0]
            const contentsNsid = firstItem && firstItem.getTemplateMetadata()
            if (nsid === contentsNsid) {
                return obj
            }
        } else {
            // Normal container.  Unit containers follow "bag.unit:base/fighter",
            // but *all* unit containers for that unit type do.  Also check the 
            // owning player slot id.
            const wantNsid = 'bag.' + nsid
            const bagNsid = obj.getTemplateMetadata()
            if (wantNsid === bagNsid) {
                if (obj.getOwningPlayerSlot() == playerSlot) {
                    return obj
                }
            }
        }
    }
    throw new Error(`getBag(${nsid}, ${playerSlot}) failed`)
}

/**
 * Does this object match rule.consume?
 * 
 * @param {GameObject} obj 
 * @param {object} rule - REPLACE_RULES entry
 * @returns {boolean}
 */
function isConsumable(obj, rule) {
    const objInfo = METADATA_TO_INFO[obj.getTemplateMetadata()]
    if (!objInfo) {
        return false
    } else if (rule.consume.name && rule.consume.name !== objInfo.name) {
        return false
    } else if (rule.consume.names && !rule.consume.names.includes(objInfo.name)) {
        return false
    } else if (rule.faceUp && Facing.isFaceDown(obj)) {
        return false
    } else if (rule.faceDown && Facing.isFaceUp(obj)) {
        return false
    }
    return true
}

/**
 * Given a list of GameObject and a rule, compute:
 * - Which items to consume.
 * - What nsid to produce and how how many.
 * 
 * @param {GameObject[]} objs 
 * @param {object} rule - REPLACE_RULES entry
 * @returns {{consume: GameObject[], produce: {nsid: string, count: number}}}
 */
function applyRule(objs, rule) {
    // Gather consumable items, fail if not enough.
    const consumable = objs.filter(obj => isConsumable(obj, rule))
    if (consumable.length < rule.consume.count) {
        return false
    }

    // Find the metadata value for the produce name.
    const nameToNsid = name => {
        for (const [nsid, entry] of Object.entries(METADATA_TO_INFO)) {
            if (entry.name === name) {
                return nsid
            }
        }
        throw new Error(`unknown name ${name}`)
    }

    const applyCount = rule.repeat ? Math.floor(consumable.length / rule.consume.count) : 1
    return {
        consume : consumable.slice(0, rule.consume.count * applyCount),
        produce : {
            nsid : nameToNsid(rule.produce.name),
            count : rule.produce.count * applyCount
        }
    }
}

const _ignoreSet = new Set()

function onR(obj, player) {
    const playerSlot = player.getSlot()

    // Careful, if multiple objects selected ALL get a separate call!
    // Pressing "R" outside any selected object still calls for each.
    // Process the group only for the first call, ignore others.
    const guid = obj.getId()
    if (_ignoreSet.has(guid)) {
        _ignoreSet.delete(guid)
        return
    }
    for (const selectedObj of player.getSelectedObjects()) {
        const selectedObjGuid = selectedObj.getId()
        if (selectedObjGuid != guid) {
            _ignoreSet.add(selectedObjGuid)
        }
    }

    // Collect the objects to process.
    let objs = player.getSelectedObjects()
    objs = objs.length > 0 ? objs : [ obj ]

    // Discard any objects owned by another player (tokens always match).
    // All objects owned by a player should have owning player slot set.
    objs = objs.filter(obj => {
        const objSlot = obj.getOwningPlayerSlot()
        return (objSlot == -1) || (objSlot == playerSlot)
    })

    // Prefer swapping tokens to units (need one plastic!).  Move to front.
    objs = objs.sort((a, b) => {
        const aId = a.getTemplateMetadata()
        const bId = b.getTemplateMetadata()
        if (aId.startsWith('token')) {
            return -1
        }
        if (bId.startsWith('token')) {
            return 1
        }
        return 0
    })

    // Find the first matching rule.
    let match
    for (const rule of REPLACE_RULES) {
        match = applyRule(objs, rule)
        if (match) {
            break
        }
    }
    if (!match) {
        return // no matching rule
    }

    // Make sure the produce can happen (empty unit bag?).
    const produceBag = getBag(match.produce.nsid, playerSlot)
    if (!isInfiniteContainer(produceBag) && produceBag.getItems().length < match.produce.count) {
        // TODO XXX LOCALE ERROR MESSAGE
        const message = 'placeholder not enough supply'
        player.showMessage(message)
        player.sendChatMessage(message)
        return // not enough supply to produce
    }

    // Fullfill rule.
    for (const obj of match.consume) {
        const consumeNsid = obj.getTemplateMetadata()
        const consumeBag = getBag(consumeNsid, playerSlot)
        if (isInfiniteContainer(consumeBag)) {
            // See global/patch-infinite-container.js
            consumeBag.addObjectsEnforceSingleton([ obj ], 0, true)
        } else {
            consumeBag.addObjects([ obj ], 0, true)
        }
    }
    for (let i = 0; i < match.produce.count; i++) {
        const pos = player.getCursorPosition().add(new Vector(0, i * 2, 5 + i * 3))
        let obj
        if (isInfiniteContainer(produceBag)) {
            // See global/patch-infinite-container.js
            obj = produceBag.takeAtEnforceSingleton(0, pos, true)
        } else {
            obj = produceBag.takeAt(0, pos, true)
        }
        if (match.faceDown) {
            obj.setRotation(new Vector(-180, 0, 0), -1)
        }
    }
}

// Add our listener to future objects.
globalEvents.onObjectCreated.add((obj) => {
    if (METADATA_TO_INFO[obj.getTemplateMetadata()]) {
        obj.onPrimaryAction.add(onR)
    }
})

// Script reload doesn't onObjectCreated existing objects, load manually.
if (world.getExecutionReason() === 'ScriptReload') {
    for (const obj of world.getAllObjects()) {
        if (METADATA_TO_INFO[obj.getTemplateMetadata()]) {
            obj.onPrimaryAction.add(onR)
        }
    }
}

// Export for the unittest.
module.exports = {
    isConsumable,
    applyRule,
    onR,
}