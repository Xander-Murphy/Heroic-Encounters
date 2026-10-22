# Warcraft Card Duels

## Technical & Business Analysis

**ASE 330 — Individual Project**
**Xander Murphy**
**Fall 2026**

---

# 1. Golden Pitch Canvas

## Why

Players who enjoy RPGs and strategy games want meaningful decisions, character variety, and engaging turn-based combat without having to learn an overly complicated system or commit to a massive game.

**Warcraft Card Duels** aims to provide a focused RPG experience centered around team composition, character abilities, and strategic combat.

## How

The game combines:

* Three-hero team building
* Unique hero classes and abilities
* Turn-based combat
* Randomized enemy encounters
* Dungeon progression
* Increasing difficulty
* Boss encounters

## What

**Warcraft Card Duels** is a Python/Pygame turn-based RPG where players build a team of three heroes and fight groups of enemies while progressing through dungeons toward powerful boss encounters.

---

# 2. Customer Personas

## Persona 1 — The Strategy Player

**Profile**

A player who enjoys turn-based games and making strategic decisions.

**Goals**

* Build an effective team
* Experiment with different abilities
* Make meaningful decisions during combat
* Overcome increasingly difficult encounters

**Pain Points**

* Complex systems
* Repetitive combat
* Limited character variety
* Battles where player decisions have little impact

**What They Value**

* Ease of access
* Strategic depth
* Variety
* Different team combinations
* Challenging encounters

---

## Persona 2 — The RPG Character Player

**Profile**

A player who enjoys RPGs primarily because of character variety, classes, abilities, and progression.

**Goals**

* Discover different characters
* Try different classes and specializations
* Build teams around different strengths
* Experience new encounters

**Pain Points**

* Limited character customization
* Small character rosters
* Games where characters feel too similar

**What They Value**

* Character variety
* Unique abilities
* Team composition
* Progression and replayability

---

# 3. Value Proposition Canvas

## Persona 1 — Strategy Player

### Customer Jobs

* Build an effective team
* Choose appropriate abilities
* React to different enemy groups
* Defeat increasingly difficult encounters

### Pains

* Repetitive battles
* Lack of meaningful decisions
* Predictable encounters

### Gains

* More strategic choices
* Different team combinations
* Challenging encounters
* Variety between battles

### Products & Services

* Three-hero team system
* Turn-based combat
* Unique abilities
* Random enemy encounters
* Boss battles

### Pain Relievers

* Different hero abilities encourage different strategies.
* Randomized encounters prevent every battle from being identical.
* Enemy types create different combat situations.

### Gain Creators

* Team composition creates strategic choices.
* Hero specializations create different roles.
* Increasing difficulty rewards effective decision-making.

---

## Persona 2 — RPG Character Player

### Customer Jobs

* Discover different heroes
* Build teams around character strengths
* Learn unique abilities
* Progress through dungeons

### Pains

* Characters that lack meaningful differences
* Limited roster variety
* Repetitive progression

### Gains

* Diverse hero roster
* Unique classes and specializations
* Distinct abilities
* Different team combinations

### Products & Services

* Multiple unique planned heroes
* Hero classes and specializations
* Individual stats
* 3–5 abilities per hero
* Team selection
* Dungeon progression

### Pain Relievers

* Heroes are designed with different strengths and abilities.
* Players can choose three heroes rather than being locked into one character.
* Different encounters encourage players to experiment with team composition.

### Gain Creators

* A diverse roster provides more combinations.
* Unique abilities make heroes feel distinct.
* Team building gives players control over their playstyle.

---

## 4. Target Market: TAM, SAM, and SOM

The target market for Warcraft Card Duels is the PC gaming market, with a more specific focus on players who enjoy role-playing games (RPGs), strategy, character customization, and turn-based combat. Market data shows that PC gaming represents a large and established portion of the overall video game industry. According to Newzoo, the global games market generated $201.6 billion in revenue during 2025, with PC gaming accounting for $43.6 billion. Newzoo's 2025 market data also estimated approximately 936 million PC players worldwide.

### Total Addressable Market (TAM)

The Total Addressable Market represents the broadest market that the game could potentially reach if there were no limitations based on genre, audience, or distribution. For Warcraft Card Duels, the TAM is the global PC gaming market.

**TAM: approximately $43.6 billion in annual revenue and approximately 936 million PC players.**

This provides a broad measure of the potential audience for a PC game. However, Warcraft Card Duels is not intended to compete for the attention of every PC gamer. The game is specifically designed around RPG, strategy, team-building, and turn-based combat mechanics, making the RPG market a more appropriate measure of the serviceable market.

**Source:** Newzoo, *Global Games Market 2025*.

### Serviceable Available Market (SAM)

The Serviceable Available Market represents the portion of the TAM that more closely matches the type of game being developed. For Warcraft Card Duels, this is the PC RPG market.

A 2025 market-research estimate from PW Consulting places the global RPG market at approximately $94.2 billion. Its platform breakdown estimates that PC RPG games generated approximately **$20.64 billion**, representing about 21.9% of the global RPG market.

**SAM: approximately $20.64 billion in annual PC RPG revenue.**

This estimate is more relevant to Warcraft Card Duels than the overall PC gaming market because the project is specifically designed as a PC RPG with team-building, character abilities, dungeon progression, and turn-based combat. The same market-research source estimates the global turn-based RPG segment at approximately **$14.01 billion** in 2025. Because this figure includes multiple platforms, it is used as supporting genre context rather than as the project's PC-only SAM.

The SAM should therefore be viewed as an estimate of the broader commercial market available to PC RPG games rather than a prediction of how much revenue Warcraft Card Duels could generate.

**Source:** PW Consulting, *Worldwide RPG Games Market 2026*, using its 2025 market estimates.

### Serviceable Obtainable Market (SOM)

The Serviceable Obtainable Market represents the portion of the SAM that a small student-developed game could realistically attempt to reach. Unlike TAM and SAM, it would be misleading to claim that Warcraft Card Duels will capture a precise percentage of the multi-billion-dollar RPG market. The project's limited development resources, small team size, lack of an established commercial brand, and limited marketing budget make even a very small market share difficult to predict.

Instead, SOM can be represented using potential unit-sales scenarios. For example, if the finished game were sold for approximately $5:

| Copies Sold | Example Revenue |
| ----------: | --------------: |
|           5 |             $25 |
|          10 |             $50 |
|          30 |            $150 |

These figures are planning scenarios rather than forecasts. They demonstrate the scale of audience required for a small independent game to generate revenue without assuming that it will capture an arbitrary percentage of the overall RPG market.

The most realistic initial SOM for Warcraft Card Duels is therefore a relatively small portion of the PC RPG audience, with success measured by attracting a dedicated group of players, receiving positive feedback, and demonstrating that the game's core team-building and turn-based combat systems can retain players. If the game were eventually expanded and commercially distributed, its obtainable market could grow through additional heroes, dungeons, abilities, and content.

---

# 5. SWOT Analysis

| Strengths                                    | Weaknesses                                             |
| -------------------------------------------- | ------------------------------------------------------ |
| Team-based turn-based combat                 | Small development team                                 |
| Distinct hero abilities and roles            | Limited development time and resources                 |
| Modular Python architecture                  | Less polished graphics than commercial RPG             |
| Randomized encounters                        | Smaller initial hero roster                            |
| Easy to expand with new heroes and abilities | Limited content compared with established RPGs         |

| Opportunities                               | Threats                                  |
| ------------------------------------------- | ---------------------------------------- |
| Growing interest in turn-based RPGs         | Large number of competing RPGs           |
| Expandable hero and ability systems         | Large established franchises             |
| Potential for additional dungeons           | Player attention is difficult to capture |
| Potential future Steam release              | Commercial RPGs have much larger budgets |
| Community feedback can guide future content | Genre competition is high                |

Turn-based RPGs continue to demonstrate strong interest, with recent releases such as *Clair Obscur: Expedition 33* receiving significant attention while combining party building with turn-based combat.

---

# 6. PESTEL Analysis

A full PESTEL review covers six factors, but only four meaningfully affect a small, single-player PC game built by one developer. Political and Environmental factors are excluded because they have no material impact on this project's scope, costs, or release.

## Economic

* The indie and RPG markets are crowded, so success depends on visibility and on giving players a reason to keep playing.
* With no marketing budget, the project relies on word of mouth and community feedback rather than paid promotion.
* The development budget is mostly time, so scope (heroes, art, content) must stay realistic.

## Social

* Mom Test respondents consistently wanted variety, strategic depth, and a clear sense of progression.
* Turn-based RPGs maintain a dedicated audience, shown by the attention given to recent releases such as *Clair Obscur: Expedition 33*.
* Players quickly abandon games with repetitive combat or slow progression, which makes retention a core design concern.

## Technological

* Python and Pygame are accessible and allow the game to run without advanced graphics hardware.
* The modular architecture makes adding heroes, abilities, and enemies straightforward.
* Pygame is not designed for high-end graphics, so visuals will remain simple and the design focuses on gameplay.

## Legal

* The project must avoid copyrighted Warcraft assets, characters, and content, using original or properly licensed material instead.
* Third-party libraries must be used according to their licenses.
* A commercial release on a platform such as Steam would require following that platform's publishing rules.

---

# 7. Competitor Analysis

## World of Warcraft

World of Warcraft is a major inspiration and therefore a competitor in terms of fantasy characters, classes, dungeons, abilities, and progression. It provides a large roster of classes and extensive dungeon and raid content.

**Advantage of Warcraft Card Duels:**

* Much smaller and easier to understand
* Focuses specifically on three-character team composition
* Turn-based rather than real-time combat
* Designed around short, focused encounters
* Does not require the scale of an MMO

---

## Darkest Dungeon

*Darkest Dungeon* is a direct genre comparison because it combines party management, dungeon progression, and strategic turn-based combat. Players recruit and lead teams of heroes through dangerous environments.

**Advantage of Warcraft Card Duels:**

* Easier character-management system
* Focus on hero abilities rather than stress and survival mechanics
* Three-hero team structure
* More straightforward combat experience

---

## Clair Obscur: Expedition 33

*Clair Obscur: Expedition 33* demonstrates the current demand for modern turn-based RPGs. It combines party building, unique character builds, and reactive turn-based combat.

**Advantage of Warcraft Card Duels:**

* Simpler combat system
* Smaller scope
* Focus on team composition and ability selection
* A shorter, more accessible experience focused on team composition and ability choices.

---

## Competitive Advantage

Warcraft Card Duels does not attempt to compete with these games in graphical quality, story length, or production value.

Its advantage is **focus**:

> **A smaller, accessible turn-based RPG centered on building a three-hero team and making strategic ability choices.**

| Game                        | Party/Team   | Turn-Based | Character Variety        | Main Difference                       |
| --------------------------- | ------------ | ---------- | ------------------------ | ------------------------------------- |
| World of Warcraft           | Yes          | No         | High                     | MMO-scale, real-time                  |
| Darkest Dungeon             | Yes          | Yes        | High                     | Complex survival/stress systems       |
| Clair Obscur: Expedition 33 | Yes          | Yes        | High                     | Larger cinematic RPG                  |
| **Warcraft Card Duels**     | **3 heroes** | **Yes**    | **Planned 15–30 heroes** | **Focused, accessible team strategy** |

---

# 8. Mom Test Analysis

## Findings

### Common Problems

* Repetitive/unengaging combat that is predictable
* decisions do not matter
* lacking meaningful progression
* lack of strategic depth

### Current Alternatives

* World of Warcraft
* Baldur's Gate 3
* Clair Obscur: Expedition 33
* Pokemon

### Desired Features

* Meaningful progression with clear goals
* Strategic combat that requires planning and forethought
* Team synergy
* Unique characters distinct playstyles/builds
* Varied encounters
* Engaging boss battles
* Rewards/achievements
* Story or other goals than just playing the game

### Behavioral Evidence

An overwhelming majority of respondants express their commitment to the genre many stating several hours every day with others stating multipe times throughout the week

Some participants reported quitting or taking long breaks from games because content was boring or no longer meaningful to them. Others report that the lack of progression or speed of progression pushes them away.

### Product Implications

Use the findings to determine whether changes should be made to:

* Hero variety
  * Should maintain a diverse roster of heroes, original 30 may be too much, having so many may be hard to make each one feel unique

* Team size
  * Original team size of 3 should stay, players want unique team composition without being hindered by too many options or complexity

* Ability design
  * abilities should have synergy and couterplay, not just reskins of the same thing on each hero, need to be unique

* Combat complexity
  * should have enough depth to require planning without being extremely complicated, responses valued decision making with some expressing a desire for short and simple

* Encounter variety
  * One of the most important things from response pool, players commonly get bored with static encounters and repetitive combat, current random enemies is a start but enemies need unique behavior

* Progression
  * Needs significant attention, players consistently wanted a clear sense of advancement. meaningful rewards, achievements, collections, or increasingly powerful abilities

---

# 9. Business Model Canvas

This canvas describes how Warcraft Card Duels creates, delivers, and captures value. Because this is an individual project, partners are limited to the people who directly contribute to development, and distribution platforms are treated as channels.

## Key Partners

* Playtesters and Mom Test participants who provide feedback during development
* Classmates and the course instructor who review progress and give feedback
* Artists or audio creators, only if assets are commissioned or licensed

## Key Activities

* Build the combat and encounter loop
* Design, balance, and expand the hero roster
* Add progression and reward features (unlocks, achievements)
* Playtest and refine based on user feedback

## Key Resources

* Python/Pygame codebase and modular architecture
* Hero, ability, and enemy content
* Developer time and skills
* Unit-test suite and uv environment

## Value Propositions

### For the Strategy Player

* Meaningful decisions in every battle
* Different team combinations and strategies
* Varied encounters, enemy behaviors, and bosses
* Challenge that rewards good planning

### For the RPG Character Player

* Diverse roster with distinct classes and abilities
* Freedom to build a team of three around favorite heroes
* Unlocks and achievements that provide a sense of progression
* Short, simple, easy-to-learn combat

## Customer Segments

* **Strategy players:** enjoy turn-based games and want depth without complexity
* **RPG character players:** enjoy classes, collecting heroes, and progression
* **PC turn-based RPG fans:** players of games such as *Darkest Dungeon* or *Clair Obscur: Expedition 33* who want a smaller, more accessible alternative

## Customer Relationships

* Self-service and easy to learn
* Community feedback shapes new content
* Goals and rewards (achievements, unlockable heroes)
* Regular updates with new heroes and dungeons

## Channels

* Steam or itch.io (potential release platforms)
* GitHub repository
* Word of mouth
* RPG communities and social media

## Cost Structure

* Developer time (largest cost)
* Art, audio, and asset creation or licenses
* Platform fees if released commercially
* Testing and marketing

## Revenue Streams

* One-time game purchase (approximately $5 planning price, consistent with the SOM scenarios)
* Possible future paid expansions (hero or dungeon packs)

## Key Metrics

* **Daily active players:** unique players who launch the game each day
* **Return rate:** share of players who come back after 1 day and after 7 days
* **Run completion:** share of dungeon runs that reach the boss
* **Heroes unlocked per player:** a measure of collection progress
* **Copies sold and playtester feedback:** signs of market interest

---

# 10. Feasibility Plan

## Current Prototype

The project is already in active development using **Python and Pygame**.

The current architecture uses:

```text
Game
│
├── GameState
│
├── MainMenuScreen
├── TeamSelectionScreen
├── DungeonSelectionScreen
└── DungeonScreen
```

This modular structure separates game management from individual screens and allows additional functionality to be added without rewriting the entire application.

---

## Implementation Strategy

Development will continue incrementally.

### Phase 1 — Foundation

Completed:

* Python/Pygame project setup
* Game loop
* Game states
* Main menu
* Screen architecture
* Hero classes
* Enemy classes
* Hero statistics
* Ability system foundation
* Team selection
* Dungeon selection
* Dungeon structure
* Unit testing
* Generate 1–3 enemies per encounter

### Phase 2 — Combat

Next:

* Determine turn order
* Select hero actions
* Display available abilities
* Select targets
* Execute abilities
* Apply damage and effects
* Track health
* Process enemy actions
* Detect victory and defeat

### Phase 3 — Encounters & Progression

After combat:

* Add different enemy behaviors
* Implement dungeon progression
* Add increasing difficulty
* Add boss encounters
* Connect encounters into a complete gameplay loop

### Phase 4 — Content & Polish

Final development will focus on:

* Expand the hero roster while maintaining meaningful differences between heroes.
* Adding additional abilities
* Balancing heroes and enemies
* Improving UI
* Adding assets
* Testing
* Fixing bugs
* Improving usability

> The project will prioritize a complete and playable core gameplay loop over the size of the final content library. If development time becomes limited, additional heroes, abilities, dungeons, and visual assets can be reduced or postponed without preventing the core game from being completed.

---

# 11. Technical Feasibility

The project is feasible because the required technologies are already familiar and the core architecture has been implemented.

### Programming

**Python** provides the primary programming language and supports the project's object-oriented architecture.

### Game Framework

**Pygame** provides:

* Window management
* Rendering
* Keyboard input
* Game loop functionality
* Basic graphical interfaces
* Provides core game engine without needing something more complex

### Development Environment

The project uses **uv** for Python environment and dependency management.

### Testing

The project uses Python's testing framework to test individual game components such as heroes and enemies.

### Architecture

The modular architecture reduces the risk of changes in one system breaking unrelated parts of the game.

---

# 12. Feasibility Assessment

| Area                    | Feasibility           |
| ----------------------- | --------------------- |
| Python development      | High                  |
| Pygame implementation   | High                  |
| Hero/team system        | High                  |
| Turn-based combat       | High                  |
| Random encounters       | High                  |
| Enemy behaviors         | High                  |
| Boss encounters         | High                  |
| Core gameplay loop      | High                  |
| 15-30 heroes            | Moderate              |
| High-end graphics       | Low                   |
| Large-scale multiplayer | Outside current scope |

The project is feasible because its scope is intentionally focused on a small single-player RPG rather than attempting to reproduce the scale of a commercial RPG game. Alongside the technology and base foundation already being implemented and expandable

---

# 13. Conclusion

Warcraft Card Duels addresses a desire for a focused strategic RPG experience by combining team building, unique characters, turn-based combat, and dungeon progression.

The project has already progressed beyond the conceptual stage and has an implemented foundation consisting of game states, screens, heroes, enemies, abilities, team selection, and dungeon selection.

The primary remaining development challenge is completing the combat and encounter loop, followed by expanding content and testing the game with potential users.

The strongest opportunity for the project is its focused scope:

> **Build a simple, strategic, replayable RPG where the player's team composition and ability choices determine how they overcome each encounter.**