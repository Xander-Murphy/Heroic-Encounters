---
marp: true
html: true
paginate: true
---

# Warcraft Card Duels

## Technical & Business Analysis

**ASE 330 Project**
Xander Murphy · Fall 2026

---

# 1. Golden Pitch Canvas

**Why**
Strategy/RPG players want meaningful decisions, character variety, and engaging turn-based combat without a complicated system or a massive time commitment.

**How**
Three-hero teams · unique classes and abilities · turn-based combat · random encounters · dungeon progression · bosses

**What**
A Python/Pygame turn-based RPG where players build a team of three heroes and fight through dungeons toward powerful boss encounters.

---

# 2. Customer Personas

**The Strategy Player**
- Enjoys turn-based games and meaningful decisions
- Goals: build an effective team, experiment with abilities, beat harder encounters
- Pain points: complex systems, repetitive combat, decisions with little impact

**The RPG Character Player**
- Enjoys classes, abilities, and progression
- Goals: discover heroes, try specializations, build teams around strengths
- Pain points: small rosters, characters that feel too similar, limited customization

---

# 3. Value Proposition: Strategy Player

| | |
|---|---|
| **Jobs** | Build a team, choose abilities, react to enemy groups, beat harder fights |
| **Pains** | Repetitive battles, predictable encounters, no meaningful choices |
| **Gains** | Strategic choices, varied team combos, challenge |
| **Products** | 3-hero teams, turn-based combat, unique abilities, random encounters, bosses |
| **Pain relievers** | Different abilities drive different strategies; randomized encounters and enemy types vary every battle |
| **Gain creators** | Team composition and specializations create roles; difficulty rewards good decisions |

---

# 3. Value Proposition: RPG Character Player

| | |
|---|---|
| **Jobs** | Discover heroes, build around strengths, learn abilities, progress through dungeons |
| **Pains** | Characters that lack differences, limited roster, repetitive progression |
| **Gains** | Diverse roster, unique classes, distinct abilities, many team combos |
| **Products** | Planned hero roster, classes/specializations, stats, 3–5 abilities each, team selection |
| **Pain relievers** | Heroes have distinct strengths; choose any three; encounters push experimentation |
| **Gain creators** | A diverse roster means more combinations; unique abilities make heroes feel distinct |

---

# 4. Target Market (TAM / SAM / SOM)

- **TAM – Global PC gaming:** ~$43.6B revenue, ~936M players (Newzoo, 2025)
- **SAM – PC RPG market:** ~$20.64B (~21.9% of a $94.2B global RPG market; PW Consulting). Global turn-based RPG segment: ~$14.01B (context only)
- **SOM – Realistic for solo developer game:** a small, dedicated group of players, mainly friends and those in the space

---

# 5. Strengths & Weaknesses

| Strengths | Weaknesses |
|---|---|
| Team-based turn-based combat | Small team, limited time and resources |
| Distinct hero abilities and roles | Less polished graphics |
| Modular, easy-to-expand architecture | Smaller roster and content than established RPGs |

---

# 5. Opportunities & Threats

| Opportunities | Threats |
|---|---|
| Growing interest in turn-based RPGs | Many competing RPGs and big franchises |
| Expandable heroes, abilities, dungeons | Player attention is hard to capture |
| Possible Steam release; community feedback | Far larger commercial budgets |

---

# 5. PESTEL Analysis

- **Economic:** Crowded indie/RPG market; no marketing budget, so success depends on word of mouth and retention; budget is mostly development time
- **Social:** Players want variety, depth, and visible progression (Mom Tests); turn-based RPGs keep a dedicated audience
- **Technological:** Python/Pygame is accessible and runs on modest hardware; modular design eases expansion; no high-end graphics
- **Legal:** Must avoid copyrighted Warcraft assets; respect library licenses; follow platform rules if sold commercially

*Political and Environmental omitted: no material impact on a solo, lightweight PC game.*

---

# 6. Competitor Analysis

| Game | Team | Turns | Variety | Main difference |
|---|---|---|---|---|
| World of Warcraft | Yes | No | High | MMO-scale, real-time |
| Darkest Dungeon | Yes | Yes | High | Complex stress/survival systems |
| Clair Obscur: Expedition 33 | Yes | Yes | High | Larger cinematic RPG |
| **Warcraft Card Duels** | **3 heroes** | **Yes** | **Yes** | **Focused, accessible team strategy** |

**Our advantage is focus:** a smaller, accessible turn-based RPG centered on three-hero team building and strategic ability choices, not competing on graphics, or production value.

---

# 7. Mom Test Findings

**Problems:** repetitive, predictable combat · decisions that don't matter · little meaningful progression · lack of strategic depth

**Alternatives used:** World of Warcraft, Baldur's Gate 3, Clair Obscur: Expedition 33, Pokémon

**Desired:** clear progression goals · strategic combat · team synergy · distinct characters · varied encounters · engaging bosses · rewards and achievements · goals beyond just playing

**Behavior:** Most respondents play the genre for hours daily or several times a week, but some quit when content felt boring or progression felt too slow.

---

# 7. Mom Test: Product Implications

- **Hero variety:** keep a diverse roster; 30 may be too many to keep unique
- **Team size:** keep 3 – variety without overload
- **Abilities:** need synergy and counterplay, not reskins
- **Combat:** enough depth to require planning, but short and simple
- **Encounters:** unique enemy behavior – a top priority
- **Progression:** needs the most attention – rewards, achievements, collections, stronger abilities

---

# User Experience & Retention

**Gap:** nothing yet gives players a reason to come back.

**Proposed improvements**
- **Daily Dungeon:** one fixed-seed run per day with a special modifier
- **Daily Reward:** first win of the day earns a bonus
- **Hero Unlocks:** earn heroes over time to create a collection goal
- **Achievements & Streaks:** e.g., beat a boss with a mono-class team
- **Quick Battles:** clear turn order and ability tooltips

*Unlocks and achievements first; daily features if time allows.*

---

# Business Model Canvas: Partners, Activities & Resources

**Key Partners**
- Playtesters and Mom Test participants who give feedback during development
- Classmates and instructor who review progress
- Artists or audio creators, only if assets are commissioned or licensed

**Key Activities**
- Build the combat and encounter loop
- Design, balance, and expand the hero roster
- Add retention features (unlocks, achievements, daily rewards)
- Playtest and refine from user feedback

**Key Resources**
- Python/Pygame codebase and modular architecture
- Hero, ability, and enemy content
- Developer time and skills
- Unit-test suite and uv environment

---

# Business Model Canvas: Value & Customers

**Value Propositions**

*For the strategy player*
- Meaningful decisions in every battle
- Different team combinations and strategies
- Varied encounters, enemy behaviors, and bosses
- Challenge that rewards good planning

*For the RPG character player*
- Diverse roster with distinct classes and abilities
- Freedom to build a team of three around favorite heroes
- Unlocks, achievements, and daily rewards to keep progressing
- Short, simple, easy-to-learn combat

**Customer Segments**
- *Strategy players:* enjoy turn-based games, want depth without complexity
- *RPG character players:* enjoy classes, collecting heroes, and progression
- *PC turn-based RPG fans:* fans of Darkest Dungeon or Expedition 33 who want a smaller, accessible alternative

---

# Business Model Canvas: Relationships & Channels

**Customer Relationships**
- Self-service and easy to learn
- Community feedback shapes new content
- Goals and rewards (achievements, daily dungeon, streaks)
- Regular updates with new heroes and dungeons

**Channels**
- Steam or itch.io (potential release platforms)
- GitHub repository
- Word of mouth
- RPG communities and social media

---

# Business Model Canvas: Costs, Revenue & Metrics

**Cost Structure**
- Developer time (largest cost)
- Art, audio, and asset creation or licenses
- Platform fees if released commercially
- Testing and marketing

**Revenue Streams**
- One-time game purchase (~$5 planning price)
- Possible future paid expansions (hero or dungeon packs)

**Key Metrics**
- *Daily active players:* unique players who launch the game each day
- *Return rate:* share of players who come back after 1 day and after 7 days
- *Daily dungeon participation:* players who complete the daily run
- *Run completion:* share of dungeon runs that reach the boss
- *Heroes unlocked per player:* a measure of collection progress
- *Copies sold and playtester feedback:* signs of market interest

---

# 8. Feasibility Plan

**Prototype:** Python + Pygame + Modular Structure (uv for environment, unit tests for heroes and enemies).

| Phase | Status | Scope |
|---|---|---|
| 1. Foundation | **Done** | Game loop, states, menus, heroes, enemies, abilities, team and dungeon selection, 1–3 enemies per encounter |
| 2. Combat | Next | Turn order, actions, targets, damage, enemy turns, win/lose |
| 3. Progression | Planned | Enemy behaviors, difficulty scaling, bosses, full gameplay loop |
| 4. Content & Polish | Planned | More heroes and abilities, balancing, UI, assets, retention features, testing |

*Core playable loop takes priority over content size; heroes, dungeons, and assets can be cut if time runs short.*

---

# 8. Feasibility Assessment

| Area | Feasibility |
|---|---|
| Python / Pygame, hero and team system | High |
| Turn-based combat, encounters, enemy behaviors, bosses | High |
| Core gameplay loop | High |
| 15–30 heroes | Moderate |
| High-end graphics | Low |
| Multiplayer | Outside scope |

Focused single-player scope plus an existing, expandable foundation makes the project feasible.

---

# Conclusion

Warcraft Card Duels delivers a simple, strategic, replayable RPG where **team composition and ability choices decide each encounter**.

- Foundation already built: states, screens, heroes, enemies, abilities, selection
- Next: finish combat and encounters, add retention features, then expand content and test with users