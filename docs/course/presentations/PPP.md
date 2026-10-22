---
marp: true
html: true

---
# Warcraft Card Duels – Individual Project

**ASE 420**  
Xander Murphy

---
# Project Description

- Problem: Players want an engaging turn-based RPG experience with varied heroes, abilities, enemies, and challenging boss fights.
- Goal: Create a turn-based RPG game with a variety of heroes with unique abilities and enemies to face.
- Proposed Solution: Build a Python game where players create a team of 3 heroes and fight randomly generated groups of enemies before facing powerful bosses.


---
# Core Features Overview

- Hero & Team System
- Combat System
- Encounters and Progression

---
# Feature 1: Heros & Team System

## Description
Players will be able to select from a variety of heros to create a team of 3

## Requirements
- Maintain a substancial roster of unique heros
- Each hero has a unique class, specialization, and stats
- Each hero has 3-5 unique abilities
- Players can create a team of 3 heros to traverse dungeons and other encounters

---
# Feature 2: Combat System

## Description
Turn-based combat between a player's team and enemies

## Requirements
- Determine turn order for each hero or enemy
- Allow each hero and enemy to use abilities
- Abilities have unique effects or damage
- Track health and other combat stats
- Detect victory or defeat conditions

---
# Feature 3: Encounters and Progression

## Description
Fight waves of enemies before a boss encounter

## Requirements
- Each wave of enemies has 1-3 random mobs
- Enemies have different types and behaviors
- Scaling difficulty as game progresses
- Provide clear victory conditions

---
# Total Features and Requirements

Features: 3
Requirements: 13
  
---
# Architecture 

- Modular, object-oriented architecture
- Separate systems for heroes, combat, encounters, and UI
- Designed to make adding new heroes, abilities, and enemies easier

---
# Design

- Encapsulation — Classes manage their own data and behavior.
- Separation of Concerns — Each system has a specific responsibility.
- Inheritance — Shared character functionality can be reused.
- Composition — Heroes can contain their abilities.
- State Pattern — Used to manage different game states.
- Strategy Pattern — Can be used for different enemy behaviors.

---
# Schedule & Milestones

## Sprint 1
- Week 4: Setup
- Week 5: Game States
- Week 6: Characters
- Week 7: Turns & Actions
- Week 8: Win Conditions & Testing

---
# Schedule & Milestones

## Sprint 2
- Week 10: New Heroes
- Week 11: Team Selection
- Week 12: Abilities
- Week 13 Enemy Types & Encounters
- Week 14: Finishing Touches & Testing

---
# Project Documentation

- [Project Plan Presentation (PPP)](https://github.com/Xander-Murphy/Warcraft-Card-Duels/blob/main/docs/PPP.pdf)
- [GitHub Repository](https://github.com/Xander-Murphy/Warcraft-Card-Duels)