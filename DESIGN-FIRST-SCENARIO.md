# Iron Dawn: first scenario (design draft for the owner's review)

Status: draft, nothing built yet. All names, numbers and wording here are original to this project (working names, check any final title before selling).

## The idea in one paragraph
One giant walking war machine (the **Prowler**, the smallest of the machine line) pushes north through a ruined city toward a human **Field HQ**. A dozen human units are dug in and must stop it. The humans win by destroying the Prowler (or leaving it crawling and unable to fight) before it wrecks the HQ. The machine wins by destroying the HQ. Alternating turns, everything in the open, no secret orders.

## Turn order (same for both sides)
1. **Recovery**: stunned units that sat out a full enemy turn wake up.
2. **Move**: each unit moves up to its Move (terrain costs below). Machine moving into a human unit's hex = **crush** (see below).
3. **Fire**: each unit or machine weapon fires once at one target within Reach. Fire can be combined on one target.
Then the other side goes.

## One combat rule
Add up the **Power** of everything firing at one target. Roll one die (d6) and add (total Power minus target Armor). Armor is doubled for infantry in ruins.

| Result | Effect |
|---|---|
| 2 or less | No effect |
| 3 or 4 | **Stunned** (can't move or fire; turn the counter over) |
| 5 or more | **Destroyed** |

A stunned unit hit again is destroyed on 4 or more. Infantry: a stun removes one squad instead, and a destroy removes the whole stack.
This is deliberately simpler than a ratio table and easy to show on a phone ("Power 7 vs Armor 3: roll + 4").

## Terrain (small ruined-city map, 15 hexes wide, 12 deep)
| Terrain | Move cost (tracked) | Notes |
|---|---|---|
| Street | 1 | Units that start and stay on street get +1 Move |
| Rubble | 2 | Infantry Armor x2 |
| Ruins (walls standing) | 2 | Infantry Armor x2; all others Armor +1 |
| Wreck field | blocked | Fire passes over; nobody enters |

Ruined-city feel: a main street running south to north with side lanes and rubble blocks, so the machine is funnelled and the defenders can set up crossfire.

## Human units (Power / Reach / Armor / Move)
| Unit | Power | Reach | Armor | Move | Cost |
|---|---|---|---|---|---|
| Bulwark (heavy tank) | 4 | 2 | 3 | 3 | 1 |
| Scout (light tank) | 2 | 2 | 2 | 4 | 1/2 |
| Lancer (missile tank) | 3 | 4 | 2 | 2 | 1 |
| Skimmer (hovercraft) | 2 | 2 | 2 | 5 | 1/2 |
| Long Gun (artillery, can't move) | 6 | 6 | 1 | 0 | 2 |
| Rifle Squads (1 to 3 per counter) | 1 each | 1 | squads | 2 | 1 per 3 |
| Field HQ | 0 | 0 | 0 | 0 | free |

Scenario 1 force: 6 vehicles worth of cost plus 9 squads (three 3-squad counters), about 12 counters. Max 3 squads or 1 vehicle per hex.

## The Prowler (machine)
Hit boxes tracked on a damage sheet, each weapon fires once a turn until destroyed:
| Part | Count | Power | Reach | Armor |
|---|---|---|---|---|
| Main Cannon | 1 | 5 | 3 | 4 |
| Side Guns | 3 | 3 | 2 | 3 |
| Missiles (one shot each) | 2 | 5 | 5 | 2 |
| Anti-troop guns (only useful vs infantry) | 6 | 1 | 1 | 1 |
| Treads | 30 boxes | | | |

- **Hitting a part**: choose the part, attack it like a unit using that part's Armor. Destroyed = part is gone.
- **Hitting treads**: always Armor 1, but the damage is "boxes lost" instead of a destroy roll: each point of total Power that gets through costs that many tread boxes (on a result of 5+; a 3 or 4 costs half, rounded down).
- **Move by treads left**: 21 to 30 boxes = Move 3, 11 to 20 = 2, 1 to 10 = 1, 0 = stuck (can still fire).
- **Crush**: moving into a hex with a human vehicle destroys it (roll d6: 1 to 3 stunned, 4 to 6 destroyed) and costs the Prowler 2 tread boxes; infantry are removed and cost 0. Crush is not an attack.
- **Destroyed** when all weapons and treads are gone.

## Victory
- Machine wins: destroys the Field HQ (it moves into the HQ hex, or fires Power 3 or more at it and rolls 5+).
- Humans win: Prowler destroyed or stuck with no cannon and no side guns, while the Field HQ stands.
- Marginal: Prowler stuck, but still armed and in range of the HQ, nobody wins; play out three more turns.

## How it maps onto the code we copied from Colosseum
| Piece | Plan |
|---|---|
| `net.js` | Unchanged. Room, seats, joins, private messages. |
| `voice.js`, Firebase files | Unchanged. |
| `phone-map.js` | Draws hexes and counters from a scene `{bd, u, hl}`. Ogre-like units are one hex each, so facing circles are dropped. |
| Host page (new `host.html`) | Based on `online-host.js` lobby, new game screen. |
| Phone page (new `phone.html`) | Based on Colosseum's: join with name and table passcode, pick a unit, tap hex to move, tap target to fire. |
| Rules (new `rules.js`) | Pure functions, no screen code: `move`, `fire`, `crush`, `recover`, `victory`. Easy to test headless. |
| Scenario (new `scenario1.js`) | Map hexes with terrain, force lists, victory text. |
| Machine AI (new `machine-ai.js`) | See below. |

## Machine AI (first version)
1. Move along the cheapest path toward the HQ, but stop in range of the best target.
2. Each weapon fires at: the unit it is most likely to destroy; HQ if in range; otherwise the most dangerous human unit.
3. Missiles are saved until the target would be destroyed on a roll of 5+ with the missile added.
4. Kept simple and readable so it can be tuned; the owner's "a little harder than book" rule applies later.

## Build order (one feature at a time, owner tests each)
1. **Rules file + tests**: moves, fire, crush, damage sheet. No screen.
2. **Solo board on the tablet**: map, counters, humans vs computer machine, all on one device.
3. **One phone plays the humans**, tablet hosts and shows the full map.
4. **Several phones**, each commanding some units; remote players via Firebase.
5. **Human plays the machine** from a phone (computer plays defenders optional).
6. More machines in the line (Brute, Marauder...), more scenarios, campaign.

## Questions for the owner
1. Is the combat rule (roll + Power minus Armor, stun or destroy) the right feel, or do you want something closer to a ratio table?
2. Should the first version have the computer play the machine, or a human on a phone?
3. Ruined city map as described, or a different setting?
4. Counters: simple shapes and letters first, then your art later (as in Colosseum)?
