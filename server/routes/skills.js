import express from "express";
import User from "../models/User.js";
import { getUserForReq } from "../utils/demoUser.js";

const router = express.Router();

const SKILLS = [
	{ id: "morning_warrior", name: "Morning Warrior", unlockLevel: 2, maxLevel: 5, category: "Fitness", description: "Master the art of consistent training" },
	{ id: "iron_body", name: "Iron Body", unlockLevel: 4, maxLevel: 5, category: "Fitness", description: "Build incredible physical strength" },
	{ id: "peak_performance", name: "Peak Performance", unlockLevel: 8, maxLevel: 5, category: "Fitness", description: "Reach your physical peak" },
	{ id: "cardio_commander", name: "Cardio Commander", unlockLevel: 6, maxLevel: 5, category: "Fitness", description: "Elevate your stamina and heart health" },
	{ id: "flexibility_sage", name: "Flexibility Sage", unlockLevel: 10, maxLevel: 5, category: "Fitness", description: "Develop elite mobility and resilience" },
	{ id: "endurance_titan", name: "Endurance Titan", unlockLevel: 14, maxLevel: 5, category: "Fitness", description: "Sustain peak output for long durations" },
	{ id: "metabolic_overdrive", name: "Metabolic Overdrive", unlockLevel: 18, maxLevel: 5, category: "Fitness", description: "Optimize energy systems for sustained effort" },
	{ id: "precision_mobility", name: "Precision Mobility", unlockLevel: 22, maxLevel: 5, category: "Fitness", description: "Control ranges with strength and grace" },
	{ id: "power_engineer", name: "Power Engineer", unlockLevel: 26, maxLevel: 5, category: "Fitness", description: "Explosive output with fast recovery" },
	{ id: "hybrid_athlete", name: "Hybrid Athlete", unlockLevel: 30, maxLevel: 5, category: "Fitness", description: "Blend strength and endurance" },
	{ id: "recovery_maestro", name: "Recovery Maestro", unlockLevel: 35, maxLevel: 5, category: "Fitness", description: "Shorten downtime, extend peak phases" },
	{ id: "grandmaster_conditioning", name: "Grandmaster Conditioning", unlockLevel: 40, maxLevel: 5, category: "Fitness", description: "Elite conditioning across domains" },

	{ id: "speed_reader", name: "Speed Reader", unlockLevel: 2, maxLevel: 5, category: "Learning", description: "Read faster while retaining more" },
	{ id: "knowledge_seeker", name: "Knowledge Seeker", unlockLevel: 4, maxLevel: 5, category: "Learning", description: "Constantly expand your knowledge" },
	{ id: "master_mind", name: "Master Mind", unlockLevel: 8, maxLevel: 5, category: "Learning", description: "Become a master of disciplines" },
	{ id: "memory_architect", name: "Memory Architect", unlockLevel: 6, maxLevel: 5, category: "Learning", description: "Engineer long-term recall systems" },
	{ id: "polyglot", name: "Polyglot", unlockLevel: 10, maxLevel: 5, category: "Learning", description: "Acquire languages with ease" },
	{ id: "socratic_thinker", name: "Socratic Thinker", unlockLevel: 14, maxLevel: 5, category: "Learning", description: "Refine judgment through questioning" },
	{ id: "concept_alchemist", name: "Concept Alchemist", unlockLevel: 18, maxLevel: 5, category: "Learning", description: "Synthesize ideas into new frameworks" },
	{ id: "spaced_recall", name: "Spaced Recall", unlockLevel: 22, maxLevel: 5, category: "Learning", description: "Leverage intervals for perfect memory" },
	{ id: "systems_thinker", name: "Systems Thinker", unlockLevel: 26, maxLevel: 5, category: "Learning", description: "See structure in complexity" },
	{ id: "meta_learner", name: "Meta Learner", unlockLevel: 30, maxLevel: 5, category: "Learning", description: "Master how to master skills" },
	{ id: "research_savant", name: "Research Savant", unlockLevel: 35, maxLevel: 5, category: "Learning", description: "Surface signals, dismiss noise" },
	{ id: "grand_theorist", name: "Grand Theorist", unlockLevel: 40, maxLevel: 5, category: "Learning", description: "Formulate unifying models" },

	{ id: "time_master", name: "Time Master", unlockLevel: 3, maxLevel: 5, category: "Productivity", description: "Master time management" },
	{ id: "deep_focus", name: "Deep Focus", unlockLevel: 5, maxLevel: 5, category: "Productivity", description: "Enter deep concentration" },
	{ id: "flow_state", name: "Flow State", unlockLevel: 9, maxLevel: 5, category: "Productivity", description: "Achieve perfect flow" },
	{ id: "habit_alchemist", name: "Habit Alchemist", unlockLevel: 7, maxLevel: 5, category: "Productivity", description: "Transmute small actions into systems" },
	{ id: "automation_wizard", name: "Automation Wizard", unlockLevel: 11, maxLevel: 5, category: "Productivity", description: "Automate repetitive workflows" },
	{ id: "distraction_slayer", name: "Distraction Slayer", unlockLevel: 15, maxLevel: 5, category: "Productivity", description: "Eliminate attention drains" },
	{ id: "context_switch_nemesis", name: "Context Switch Nemesis", unlockLevel: 18, maxLevel: 5, category: "Productivity", description: "Crush task switching overhead" },
	{ id: "priority_oracle", name: "Priority Oracle", unlockLevel: 22, maxLevel: 5, category: "Productivity", description: "Always choose the highest-leverage task" },
	{ id: "ops_conductor", name: "Ops Conductor", unlockLevel: 26, maxLevel: 5, category: "Productivity", description: "Coordinate complex execution" },
	{ id: "energy_manager", name: "Energy Manager", unlockLevel: 30, maxLevel: 5, category: "Productivity", description: "Schedule by energy, not time" },
	{ id: "pipeline_architect", name: "Pipeline Architect", unlockLevel: 35, maxLevel: 5, category: "Productivity", description: "Continuous delivery of outcomes" },
	{ id: "grand_executor", name: "Grand Executor", unlockLevel: 40, maxLevel: 5, category: "Productivity", description: "Ship relentlessly, at scale" },

	{ id: "side_hustler", name: "Side Hustler", unlockLevel: 2, maxLevel: 5, category: "Business", description: "Start building your empire" },
	{ id: "entrepreneur", name: "Entrepreneur", unlockLevel: 6, maxLevel: 5, category: "Business", description: "Build and scale businesses" },
	{ id: "tycoon", name: "Tycoon", unlockLevel: 12, maxLevel: 5, category: "Business", description: "Master the art of business" },
	{ id: "deal_maker", name: "Deal Maker", unlockLevel: 8, maxLevel: 5, category: "Business", description: "Negotiate and close with precision" },
	{ id: "brand_architect", name: "Brand Architect", unlockLevel: 10, maxLevel: 5, category: "Business", description: "Design magnetic brand presence" },
	{ id: "grand_strategist", name: "Grand Strategist", unlockLevel: 16, maxLevel: 5, category: "Business", description: "Craft winning long-term strategies" },
	{ id: "market_cartographer", name: "Market Cartographer", unlockLevel: 18, maxLevel: 5, category: "Business", description: "Map territories others can’t see" },
	{ id: "growth_engineer", name: "Growth Engineer", unlockLevel: 22, maxLevel: 5, category: "Business", description: "Design compounding growth loops" },
	{ id: "pricing_sage", name: "Pricing Sage", unlockLevel: 26, maxLevel: 5, category: "Business", description: "Capture value with elegance" },
	{ id: "moat_builder", name: "Moat Builder", unlockLevel: 30, maxLevel: 5, category: "Business", description: "Engineer defensibility" },
	{ id: "capital_alchemist", name: "Capital Alchemist", unlockLevel: 35, maxLevel: 5, category: "Business", description: "Transmute resources into runway" },
	{ id: "grand_industrialist", name: "Grand Industrialist", unlockLevel: 40, maxLevel: 5, category: "Business", description: "Scale operations into empires" },
];

async function getUser(req) {
	return await getUserForReq(req);
}

router.get("/", async (req, res) => {
	try {
		const user = await getUser(req);
		// Make skills 5x harder to unlock
		const withProgress = SKILLS.map((s) => {
			const effectiveUnlock = Math.max(1, (s.unlockLevel || 1) * 5);
			const unlocked = user.level >= effectiveUnlock;
			const level = unlocked ? Math.min(s.maxLevel, Math.max(1, user.level - effectiveUnlock + 1)) : 0;
			return { ...s, unlockLevel: effectiveUnlock, unlocked, level };
		});
		const unlocked = withProgress.filter((s) => s.unlocked);
		const locked = withProgress.filter((s) => !s.unlocked);
		const categories = ["Fitness", "Learning", "Productivity", "Business"];
		const summary = categories.map((c) => {
			const all = withProgress.filter((s) => s.category === c);
			return { category: c, unlocked: all.filter((s) => s.unlocked).length, total: all.length };
		});
		return res.json({ unlocked, locked, level: user.level, summary, all: withProgress });
	} catch (e) {
		// eslint-disable-next-line no-console
		console.error(e);
		return res.status(500).json({ error: "Failed to load skills" });
	}
});

export default router;

