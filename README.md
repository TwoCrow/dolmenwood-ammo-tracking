# Dolmenwood: Ammo Tracking

A FoundryVTT module that adds automatic ammunition tracking for ranged weapons in the Dolmenwood system.

## Requirements

- FoundryVTT v13
- Dolmenwood system v1.9.5 or higher

## Installation

### Via Manifest URL

1. In FoundryVTT, open Configuration > Add-on Modules > Install Module.
2. Paste the manifest URL into the Manifest URL field at the bottom of the dialog:
   ```
   https://raw.githubusercontent.com/TwoCrow/dolmenwood-ammo-tracking/main/module.json
   ```
3. Click Install and wait for the installation to complete.
4. Enable the module in your world under Game Settings > Manage Modules.

## Using the Module

### Step 1 — Tag a gear item as ammunition

1. Open the item sheet for a gear item you want to serve as ammunition (e.g. Arrows, Bolts).
2. In the item details, check the "Is Ammo" checkbox that appears in the item properties section.
3. Save and close the sheet.

### Step 2 — Link a weapon to its ammunition

1. Open the item sheet for a missile weapon (e.g. Shortbow, Light Crossbow).
2. In the weapon details section, find the Ammunition dropdown.
3. Select the ammo item you tagged in Step 1. Only items marked as ammo that are in the actor's inventory appear in this list.
4. Save and close the sheet.

The Ammunition dropdown only appears for weapons owned by an actor, since it reads from that actor's inventory.

## How it works

When a player makes a missile attack roll and selects the missile weapon, the module consumes ammo as follows:

1. If the missile weapon has enough of the linked ammunition item in the player's inventory, it decrements the quantity of the ammo by one then makes the roll.
2. If the missile weapon's ammo type is depleted, a special message will appear in chat alerting that the player is out of ammo. No attack roll is made.
3. If the missile weapon has no ammo type selected, these checks are bypassed and the roll happens as normal.
