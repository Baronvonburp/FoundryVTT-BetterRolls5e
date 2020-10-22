import { i18n } from "./betterrolls5e.js";
import { DND5E as dnd5e } from "../../../systems/dnd5e/module/config.js";

/**
 * Check if maestro is turned on.
 */
function isMaestroOn() {
	let output = false;
	try { if (game.settings.get("maestro", "enableItemTrack")) {
		output = true;
	} }
	catch { return false; }
	return output;
}

export class Utils {
	/**
	 * The sound to play for dice rolling. Returns null if an alternative sound
	 * from maestro or dice so nice is registered.
	 * This should be added to the chat message under sound.
	 * @param {boolean} hasMaestroSound optional parameter to denote that maestro is enabled
	 * @returns {string}
	 */
	static getDiceSound(hasMaestroSound=false) {
		const has3DDiceSound = game.dice3d ? game.settings.get("dice-so-nice", "settings").enabled : false;
		const playRollSounds = game.settings.get("betterrolls5e", "playRollSounds")

		if (playRollSounds && !has3DDiceSound && !hasMaestroSound) {
			return CONFIG.sounds.dice;
		}
		
		return null;
	}
	
	/**
	 * Additional data to attach to the chat message.
	 */
	static getWhisperData() {
		let rollMode = null;
		let whisper = undefined;
		let blind = null;
		
		rollMode = game.settings.get("core", "rollMode");
		if ( ["gmroll", "blindroll"].includes(rollMode) ) whisper = ChatMessage.getWhisperRecipients("GM");
		if ( rollMode === "blindroll" ) blind = true;
		else if ( rollMode === "selfroll" ) whisper = [game.user._id];
		
		return { rollMode, whisper, blind }
	}

	/**
	 * Tests a roll to see if it crit, failed, or was mixed.
	 * @param {Roll} roll 
	 * @param {number} threshold optional crit threshold
	 * @param {boolean|number[]} critChecks dice to test, true for all
	 */
	static processRoll(roll, threshold, critChecks=true) {
		if (!roll) return null;

		let high = 0;
		let low = 0;
		for (const d of roll.dice) {
			if (d.faces > 1 && (critChecks == true || critChecks.includes(d.faces))) {
				for (const result of d.results) {
					if (result.result >= (threshold || d.faces)) {
						high += 1;
					} else if (result.result == 1) {
						low += 1;
					}
				}
			}
		}

		let critType = null;
		if (high > 0 && low > 0) {
			critType = "mixed";
		} else if (high > 0) {
			critType = "success";
		} else if (low > 0) {
			critType = "failure";
		}

		return { 
			total: roll.total,
			ignored: roll.ignored ? true : undefined, 
			critType, 
			isCrit: high > 1,
		};
	}
}

export class ActorUtils {
	static getCharacterLevel(actor) {
		// Determine character level
		const level = actor.data.items.reduce((runningTotal, item) => {
			if ( item.type === "class" ) {
				const classLevels = parseInt(item.data.levels) || 1;
				runningTotal += classLevels;
			}

			return runningTotal;
		});

		return level;
	}

	/**
	 * True if the actor has the halfling luck special trait.
	 * @param {Actor} actor 
	 */
	static isHalfling(actor) {
		return getProperty(actor, "data.flags.dnd5e.halflingLucky");
	}
		
	/**
	 * True if the actor has the reliable talent special trait.
	 * @param {Actor} actor 
	 */
	static hasReliableTalent(actor) {
		return getProperty(actor, "data.flags.dnd5e.reliableTalent");
	}

	/**
	 * True if the actor has the elven accuracy feature
	 * @param {Actor} actor 
	 */
	static hasElvenAccuracy(actor) {
		return getProperty(actor, "data.flags.dnd5e.elvenAccuracy");
	}
	
	/**
	 * True if the actor has elven accuracy and the ability
	 * successfully procs it.
	 * @param {Actor} actor 
	 * @param {string} ability ability mod shorthand
	 */
	static testElvenAccuracy(actor, ability) {
		return ActorUtils.hasElvenAccuracy(actor) && ["dex", "int", "wis", "cha"].includes(ability);
	}

	static hasSavageAttacks(actor) {
		try { 
			return actor.getFlag("dnd5e", "savageAttacks");
		} catch(error) {
			return actor.getFlag("dnd5eJP", "savageAttacks");
		}
	}

	/**
	 * Returns the image to represent the actor. The result depends on BR settings.
	 * @param {Actor} actor
	 */
	static getImage(actor) {
		const actorImage = (actor.data.img && actor.data.img !== DEFAULT_TOKEN && !actor.data.img.includes("*")) ? actor.data.img : false;
		const tokenImage = actor.token?.data?.img ? actor.token.data.img : actor.data.token.img;

		switch(game.settings.get("betterrolls5e", "defaultRollArt")) {
			case "actor":
				return actorImage || tokenImage;
			case "token":
				return tokenImage || actorImage;
		}
	}
}

export class ItemUtils {
	static getActivationData(item) {
		const { activation } = item.data.data;
		const activationCost = activation.cost ? activation.cost : ""

		if (activation?.type !== "" && activation?.type !== "none") {
			return `${activationCost} ${dnd5e.abilityActivationTypes[activation.type]}`.trim();
		}

		return null;
	}

	static getDuration(item) {
		const {duration} = item.data.data;

		if (!duration?.units) {
			return null;
		}

		return `${duration.value ? duration.value : ""} ${dnd5e.timePeriods[duration.units]}`.trim()
	}

	static getRange(item) {
		const { range } = item.data.data;
	
		if (!range?.value && !range?.units) {
			return null;
		}
	
		const standardRange = range.value || "";
		const longRange = (range.long && range.long !== range.value) ? `/${range.long}` : "";
		const rangeUnit = range.units ? dnd5e.distanceUnits[range.units] : "";
	
		return `${standardRange}${longRange} ${rangeUnit}`.trim();
	}

	static getSpellComponents(item) {
		const { vocal, somatic, material } = item.data.data.components;

		let componentString = "";

		if (vocal) {
			componentString += i18n("br5e.chat.abrVocal");
		}

		if (somatic) {
			componentString += i18n("br5e.chat.abrSomatic");
		}

		if (material) {
			const materials = item.data.data.materials;
			componentString += i18n("br5e.chat.abrMaterial");

			if (materials.value) {
				const materialConsumption = materials.consumed ? i18n("br5e.chat.consumedBySpell") : ""
				componentString += ` (${materials.value}` + ` ${materialConsumption})`;
			}
		}

		return componentString || null;
	}

	static getTarget(item) {
		const { target } = item.data.data;

		if (!target?.type) {
			return null;
		}

		const targetDistance = target.units && target?.units !== "none" ? ` (${target.value} ${dnd5e.distanceUnits[target.units]})` : "";
		return i18n("Target: ") + dnd5e.targetTypes[target.type] + targetDistance;
	}

	/** 
	 * Finds if an item has a Maestro sound on it, in order to determine whether or not the dice sound should be played.
	 */
	static hasMaestroSound(item) {
		return (isMaestroOn() && item.data.flags.maestro && item.data.flags.maestro.track) ? true : false;
	}

	/**
	 * Derives the formula for what should be rolled when a crit occurs
	 * @param {string} rollFormula
	 * @returns {string} the crit formula
	 */
	static getCritRoll(item, baseFormula, baseTotal, critBehavior) {
		const critFormula = baseFormula.replace(/[+-]+\s*(?:@[a-zA-Z0-9.]+|[0-9]+(?![Dd]))/g,"").concat();
		let critRoll = new Roll(critFormula);
		
		// If the crit formula has no dice, return null
		if (critRoll.terms.length === 1 && typeof critRoll.terms[0] === "number") {
			return null;
		}

		let savage;
		if (item.actor && item.data.type === "weapon") {
			savage = ActorUtils.hasSavageAttacks(item.actor);
		}
		
		const add = savage ? 1 : 0;
		critRoll.alter(1, add);
		critRoll.roll();

		// If critBehavior = 2, maximize base dice
		if (critBehavior === "2") {
			critRoll = new Roll(critRoll.formula).evaluate({maximize:true});
		}
		
		// If critBehavior = 3, maximize base and crit dice
		else if (critBehavior === "3") {
			let maxDifference = Roll.maximize(baseFormula).total - baseTotal;
			let newFormula = critRoll.formula + "+" + maxDifference.toString();
			critRoll = new Roll(newFormula).evaluate({maximize:true});
		}

		return critRoll
	}
}

/**
 * Class used to build a growing number of dice
 * that will be flushed to a system like Dice So Nice.
 */
export class DiceCollection {
	pool = new Roll("0").roll();

	/**
	 * Creates a new DiceCollection object
	 * @param {...Roll} initialRolls optional additional dice to start with 
	 */
	constructor(...initialRolls) {
		if (initialRolls.length > 0) {
			this.push(...initialRolls);
		}
	}

	/**
	 * Creates a new dice pool from a set of rolls 
	 * and immediately flushes it, returning a promise that is
	 * true if any rolls had dice.
	 * @param {Roll[]} rolls
	 * @returns {Promise<boolean>}
	 */
	static createAndFlush(rolls) {
		return new DiceCollection(...rolls).flush();
	}

	/**
	 * Adds one or more rolls to the dice collection,
	 * for the purposes of 3D dice rendering.
	 * @param  {...Roll} rolls 
	 */
	push(...rolls) {
		for (const roll of rolls) {
			this.pool._dice.push(...roll.dice);
		}
	}

	/**
	 * Displays the collected dice to any subsystem that is interested.
	 * Currently its just Dice So Nice (if enabled).
	 * @returns {Promise<boolean>} if there were dice in the pool
	 */
	async flush() {
		const hasDice = this.pool.dice.length > 0;
		if (game.dice3d && hasDice) {
			const wd = Utils.getWhisperData();
			await game.dice3d.showForRoll(this.pool, game.user, true, wd.whisper, wd.blind || false);
		}

		this.pool = new Roll("0").roll();
		return hasDice;
	}
}
