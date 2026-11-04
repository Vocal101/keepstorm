# Keepstorm

A real-time card battler for the browser. Build an 8-card deck, spend Ember to drop troops, buildings and spells into a two-lane arena, and tear down your opponent's towers before they tear down yours. Play the CPU at four difficulty levels, team up in 2v2, or battle friends and strangers online.

**Play now:** https://vocal101.github.io/keepstorm/

## Features

- **74 cards**: 19 commons, 17 rares, 20 epics, 14 legendaries and 4 Heroes, each with original art and behavior. Card types include tanks, swarms, fliers, splash dealers, building-hunters, spawner buildings, beam weapons, chain lightning, freeze, knockback, healing, cloning, tunneling, charges, dashes, leaps, invisibility and death bombs.
- **Heroes** with activated abilities: Radiant Dash, Shadow Veil, Raise Legion and Deflect. You can run one per deck and have one on the field at a time.
- **Ascensions**: 5 cards can unlock a stronger Ascended form using Ascension Shards. Put one in either of the first two deck slots and it ascends on every third play.
- **Towers**: 4 tower defenders that change how your side towers fight (Bow Sisters, Powder Gunner, Blade Juggler, Tower Chaplain), plus 8 tower skins.
- **11 arenas**, each with its own look and its own cards to unlock as your trophies climb.
- **Battle rules**: 3-minute matches, double Ember in the last minute, then 2 minutes of sudden-death Overtime (triple Ember at the end), then a tower-health tiebreaker. Your Keep wakes up when it is hit or a side tower falls. Destroying the Keep wins instantly.
- **Opponents**: Easy, Normal, Hard and Expert CPUs with 16 themed decks. The AI reads threats, picks counters, places buildings to pull attackers, uses spells for value and to finish towers, builds pushes and uses Hero abilities.
- **Online play** over WebRTC (PeerJS): Quick Match finds another player who is searching right now, or create a room and share a 5-letter code. Online battles use tournament-standard levels.
- **Game modes**: Ladder (trophies and chests), Training Camp, Draft Duel, Triple Ember, Sudden Death, Mirror Match, Chaos Decks, Ember Rush and 2v2 Skirmish with an AI ally.
- **Progression**: card levels 1–15, gold, gems, 8 chest types with unlock timers, a free chest every 4 hours, a daily Banner Chest, a 28-step Trophy Road, daily shop deals, king level, battle log, emotes and 5 deck slots.
- Synthesized sound and music, so there are no asset downloads. Progress saves in your browser.

There are no real-money purchases. Gems come from the Trophy Road, Banner Chests and level-ups.

## Download and play

1. Click **Code → Download ZIP** on this page (or `git clone https://github.com/Vocal101/keepstorm.git`).
2. Unzip it and double-click `index.html`. The game runs straight from the file with no install and no build step.

Online play needs an internet connection, because it uses the public PeerJS server to connect players. Everything else works offline.

To serve it locally instead, run:

```bash
python scripts/devserver.py 8778
```

Then open http://localhost:8778.

## How to play

- You hold 4 of your 8 cards. Drag a card onto your half of the arena to deploy it, or tap a card and then tap the arena. Each card you play goes to the back of your deck.
- Ember refills over time, up to 10. Each card shows its Ember cost.
- Each enemy side tower you knock down earns a banner. Destroying the Keep earns all three.
- After you take a side tower, you can deploy troops on that side of the enemy's half.
- Spells can go anywhere. The Tunneler and Imp Crate can also land anywhere.
- Counter what your opponent plays. Ground-only troops can't hit fliers, splash damage melts swarms, and buildings pull troops that hunt buildings.

## Controls

| Action | Mouse / touch | Keyboard |
| --- | --- | --- |
| Deploy a card | Drag it onto the arena | `1`–`4` to pick it, then click the arena |
| Hero ability | Tap the round ability button | `Space` or `Q` |
| Emotes | Tap the face button by your cards | `E` |
| Cancel | Drag the card back to your hand | `Esc` |
| Pause / surrender | `II` button, top left | |

## Development

- Plain JavaScript and canvas with no build step. `js/sim.js` is a deterministic simulation (30 ticks per second). In online play the host runs it and streams snapshots to the other player.
- `npm test` runs headless checks: every card is played, every Hero ability is used, and dozens of full AI-vs-AI matches are simulated.
- Open the game with `?dev` to get the `T` test harness in the console. For example, `T.start({ bot: 'hard' })` starts a bot-vs-bot match, `T.run(60)` simulates 60 seconds, `T.lineup()` draws every unit, and `T.unlockAll()` gives you every card.

Fonts: Lilita One and Rubik (SIL Open Font License, see `fonts/`). Networking: [PeerJS](https://peerjs.com) (MIT).
