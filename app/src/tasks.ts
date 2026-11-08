export type Task = {
  id: string;
  name: string;
  area: "Bathroom" | "Kitchen" | "Living area" | "Hallway" | "Whole flat" | "Joni" | "One-off";
  freq: 1 | 2 | 4 | 8 | 12; // every N weeks
  phase: number; // first week index it is due
  owner0: 0 | 1; // who does the first occurrence; alternates after that
  fixed?: 0 | 1; // always this person, not alternated, left out of the fair-share count
  weekOwners?: Record<number, 0 | 1>; // one-off owner for a given week index
  replaces?: string | string[]; // retired job(s) whose old tick also counts for this one
  alsoDue?: number[]; // extra weeks it is due outside its normal pattern
  until?: number; // retired after this week index (kept so old weeks still add up)
  runsOnly?: boolean;
  custom?: { id: string; anyone: boolean; weekId: string }; // a one-off job someone added // never ticked or assigned: logged per run by whoever does it
  minutes: number;
  kit: string[];
  steps: string[];
  tip?: string;
  safety?: string;
};

// Aim: the minimum that keeps the flat properly clean, about 2½ hours each a week on average.
// Each estimate is built from parts: clearing the area + getting kit out + the cleaning itself
// (scaled to a small London flat) + emptying, rinsing and putting kit away. Waiting time (soaks,
// drying, wash cycles) isn't counted. Logged times replace the estimate once a job has two.
// Owners alternate on every occurrence. Phases and first owners were chosen by search
// with this week's assignments kept as they were.
export const TASKS: Task[] = [
  // ───────── Weekly ─────────
  {
    id: "toilet", name: "Toilet, sink & mirror", area: "Bathroom",
    freq: 1, phase: 0, owner0: 0, weekOwners: { 0: 1 }, minutes: 20,
    kit: ["Toilet cleaner", "Toilet brush", "Bathroom spray", "2 microfibre cloths (one kept for the toilet)", "Rubber gloves"],
    steps: [
      "Squirt toilet cleaner under the rim and leave it to work while you do the sink.",
      "Move toothbrushes and bottles off the sink. Spray the basin and taps, scrub, rinse, and buff the taps dry so they don't spot.",
      "Wipe the mirror with a damp microfibre cloth, then polish with a dry one.",
      "Brush the toilet bowl and flush. With the toilet-only cloth, wipe from cleanest to dirtiest: flush handle, cistern, lid, seat on both sides, rim, then the base and the floor around it.",
      "Empty the bathroom bin, top up toilet roll and hand soap, and swap the hand towel if it's due.",
    ],
    safety: "Never use bleach in the same session as limescale remover or anything acidic (vinegar, citric acid): together they release chlorine gas. Keep the window open or the fan on.",
  },
  {
    id: "bath", name: "Bath & glass screen", area: "Bathroom",
    freq: 1, phase: 0, owner0: 1, weekOwners: { 0: 1 }, minutes: 20,
    kit: ["Limescale remover or bathroom spray", "Non-scratch sponge", "Squeegee or dry microfibre cloth"],
    steps: [
      "Spray the bath, the tiles around it, the taps and both sides of the glass screen. Leave it 2–3 minutes. London water is hard, and this is what stops the white crust building up.",
      "Scrub the bath with the non-scratch sponge, paying attention to the tide-mark line and around the plughole.",
      "Wipe the tiles and taps, then shower everything down with clean water.",
      "Squeegee the screen top to bottom, or dry it with the cloth. A dry screen stays clear far longer.",
    ],
    tip: "A 20-second squeegee of the screen after each shower cuts this job to almost nothing.",
  },
  {
    id: "floorsbh", name: "Floors: bathroom & hallway", area: "Hallway",
    until: -1, freq: 1, phase: 0, owner0: 1, minutes: 20,
    kit: ["Hoover", "Mop and bucket (or spray mop)", "Ecoleaf hard floor cleaner"],
    steps: [
      "Lift the bath mat and move shoes, bags and the bathroom bin out of the way.",
      "Hoover the bathroom and hallway, using the crevice tool along the skirting and behind the toilet where hair collects.",
      "Mop with the floor cleaner at the label dose (60 ml in 5 litres of lukewarm water). Wring the mop until it's only damp, because the hallway boards are laminate and swell if water sits in the joints. Work back towards the door.",
      "Leave it to dry for 10 minutes, then put the mat and shoes back.",
    ],
  },
  {
    id: "bins", name: "Bins & recycling", area: "Whole flat",
    freq: 1, phase: 0, owner0: 0, runsOnly: true, minutes: 5,
    kit: ["Bin liners", "Antibacterial spray", "Kitchen roll"],
    steps: [
      "Whenever the kitchen bin or recycling is full, whoever's around takes it down to the communal bins.",
      "Rinse recycling that's still dirty and flatten cardboard so it fits.",
      "Put a fresh liner in. If the lid or rim is grubby, give it a quick spray and wipe.",
      "Grab the bathroom bin on the way if it's full.",
      "Tap \"+ I took them down\" so the run counts towards your fair share.",
    ],
  },
  {
    id: "hob", name: "Hob & worktops", area: "Kitchen",
    until: -1, freq: 1, phase: 0, owner0: 0, minutes: 25,
    kit: ["Multi-surface spray", "Hob cleaner or degreaser", "Scourer", "2 microfibre cloths"],
    steps: [
      "Clear the worktops: put away anything that lives in a cupboard and stack the rest at one end.",
      "Make sure the hob is cold. Lift off the pan supports and burner caps and soak them in hot soapy water in the sink.",
      "Spray the hob surface with degreaser and wipe it clean. Keep water away from the igniter (the little white or metal spark point by each burner).",
      "Brush crumbs into the bin, then spray and wipe all the worktops and the splashback behind the hob.",
      "Scrub the soaked supports and caps, then dry them fully before putting them back, especially the caps. A wet cap makes a burner light unevenly.",
    ],
    safety: "If a burner won't light afterwards or the flame is yellow and uneven, the cap is misaligned or wet. Turn it off, reseat or dry it, and try again.",
  },
  {
    id: "ksink", name: "Sink, handles & tea towels", area: "Kitchen",
    freq: 1, phase: 0, owner0: 0, weekOwners: { 0: 1 }, minutes: 15,
    kit: ["Cream cleaner", "Multi-surface spray", "Cloth", "Fresh tea towel and dishcloth"],
    steps: [
      "Scrub the sink basin and draining board with cream cleaner, and clear the plughole strainer.",
      "Rinse, then buff the tap dry.",
      "Wipe the things that get touched most: cupboard and drawer handles, fridge and freezer handles, kettle and toaster outsides.",
      "Swap in a clean tea towel and dishcloth. Bin the sponge if it's more than two weeks old.",
    ],
    tip: "Used tea towels and dishcloths go in a 60 °C wash, which kills the bacteria that make them smell.",
  },
  {
    id: "floorskl", name: "Floors: kitchen & living area", area: "Living area",
    until: -1, freq: 1, phase: 0, owner0: 0, minutes: 40,
    kit: ["Hoover with crevice tool", "Mop and bucket (or spray mop)", "Ecoleaf hard floor cleaner", "Microfibre cloth"],
    steps: [
      "Pick everything up off the floor, push the chairs in or up, and roll back the rug.",
      "Hoover the whole open-plan space, including under the sofa, along the skirting and around Joni's tray, where hair and litter collect.",
      "Mix the floor cleaner at the label dose: 60 ml in 5 litres of lukewarm water, or 30 ml in a half bucket. More doesn't clean better; it leaves a smeary film.",
      "Kitchen tiles: mop, starting in the far corner and working back towards the living area. If the black tiles look streaky once dry, go over them once with plain water.",
      "Laminate: wring the mop until it's only damp, with no puddles. Standing water seeps into the joints and makes the boards swell and lift. Work back towards the door.",
      "Wipe up any wet patches by the board joints with the cloth, and keep Joni off until it's dry, about 10 minutes.",
      "Empty the hoover's bin or check the bag, and pull any hair off the brush roll.",
    ],
    tip: "For a really greasy kitchen floor, mop the tiles only with soda crystals (dose on the bag), then go over them with plain water. Never use soda crystals on the laminate: the strong alkali dulls its surface.",
  },


  // ── Weekly: floors split by room, hob and worktops separate (replaced the combined jobs on 8 Nov) ──
  {
    id: "hob2", name: "Hob", area: "Kitchen",
    freq: 1, phase: 0, owner0: 1, weekOwners: { 0: 0 }, replaces: "hob", minutes: 20,
    kit: ["Hob cleaner or degreaser", "Nylon scourer", "Microfibre cloth"],
    steps: [
      "Make sure the hob is cold. Lift off the pan supports and burner caps and soak them in hot soapy water in the sink.",
      "Spray the hob surface with degreaser, leave it a couple of minutes, then wipe it clean. Keep water away from the igniters (the little spark points by each burner).",
      "Scrub the supports and caps with the nylon scourer, rinse, and dry them completely before putting them back, so each burner lights evenly.",
    ],
    tip: "If the caps are crusted, soak them overnight in soda crystals (about a mugful per litre of hot water). Only the black caps, though: the silvery crowns underneath are often aluminium, which soda corrodes.",
  },
  {
    id: "worktops", name: "Worktops & splashback", area: "Kitchen",
    freq: 1, phase: 0, owner0: 0, weekOwners: { 0: 0 }, replaces: "hob", minutes: 15,
    kit: ["Multi-surface spray", "2 microfibre cloths"],
    steps: [
      "Clear the worktops: anything that lives in a cupboard goes back, and lift the coffee and hob trays to one end.",
      "Brush crumbs into the bin, then spray and wipe the worktops and the splashback, moving things across as you go.",
      "Dry the surfaces and put the trays back.",
    ],
  },
  {
    id: "hoover-kl", name: "Hoover kitchen & living area", area: "Living area",
    freq: 1, phase: 0, owner0: 0, weekOwners: { 0: 0 }, replaces: "floorskl", minutes: 30,
    kit: ["Hoover with crevice tool"],
    steps: [
      "Pick everything up off the floor, push the chairs in or up, and roll back the rug.",
      "Hoover the whole open-plan space, including under the sofa, along the skirting and around Joni's tray, where hair and litter collect. Hoover the rug too.",
      "Empty the hoover's bin or check the bag, and pull any hair off the brush roll.",
    ],
    tip: "Hoover before either mop job, so the mop isn't pushing grit around.",
  },
  {
    id: "mop-kitchen", name: "Mop kitchen tiles", area: "Kitchen",
    freq: 2, phase: 0, owner0: 1, weekOwners: { 0: 0 }, replaces: "floorskl", minutes: 20,
    kit: ["Mop and bucket", "Ecoleaf hard floor cleaner"],
    steps: [
      "Hoover first if that job isn't done yet.",
      "Mix the floor cleaner at the label dose: 60 ml in 5 litres of lukewarm water, or 30 ml in a half bucket. More leaves smears on the black tiles.",
      "Wring the mop until it's damp. Do the edges along the units first, then the middle in figure-of-eight sweeps, walking backwards towards the living area.",
      "Rinse and wring the mop every metre or so, and change the water if it goes grey.",
      "If the tiles look streaky once dry, go over them once with plain water.",
    ],
    tip: "Wipe up spills when they happen, since this is only mopped fortnightly. For a greasy build-up, do a soda-crystal clean instead (about a mugful in a full bucket of hot water), then rinse twice with plain water. Tiles only, never the laminate.",
  },
  {
    id: "mop-living", name: "Mop living area", area: "Living area",
    freq: 2, phase: 1, owner0: 0, replaces: "floorskl", minutes: 20,
    kit: ["Mop and bucket", "Ecoleaf hard floor cleaner", "Microfibre cloth"],
    steps: [
      "Hoover first if that job isn't done yet.",
      "Mix the floor cleaner at the label dose (60 ml in 5 litres of lukewarm water).",
      "Wring the mop hard, so it's only damp. Standing water seeps into the laminate joints and makes the boards swell and lift.",
      "Do the edges first, then the middle in figure-of-eight sweeps, working back towards the door.",
      "Wipe up any wet patches at the board joints with the cloth, and keep Joni off for about 10 minutes until it's dry.",
    ],
    tip: "Fortnightly mopping only works if spills get wiped up when they happen. Hoover first if that week's hoovering isn't done yet.",
  },
  {
    id: "floor-hall", name: "Hoover & mop hallway", area: "Hallway",
    until: -1, freq: 1, phase: 0, owner0: 0, replaces: "floorsbh", minutes: 25,
    kit: ["Hoover", "Mop and bucket", "Ecoleaf hard floor cleaner"],
    steps: [
      "Move shoes and bags off the floor and lift the doormat.",
      "Hoover, using the crevice tool along the skirting and into the corners.",
      "Mop with the floor cleaner at the label dose, wringing the mop hard because the boards are laminate. Work from the far end back towards wherever you're finishing.",
      "Shake the doormat outside and put everything back once it's dry.",
    ],
  },
  {
    id: "floor-bath", name: "Hoover & mop bathroom", area: "Bathroom",
    freq: 1, phase: 0, owner0: 1, weekOwners: { 0: 1 }, replaces: "floorsbh", minutes: 25,
    kit: ["Hoover", "Mop and bucket", "Ecoleaf hard floor cleaner"],
    steps: [
      "Lift the bath mat and move the bin and anything else off the floor.",
      "Hoover, getting behind the toilet and along the bath panel where hair collects.",
      "Mop with the floor cleaner at the label dose, starting behind the toilet and working back to the door.",
      "Put the mat back once the floor is dry.",
    ],
    tip: "The hallway hoover is always the same person's as the bathroom floor that week. Do them back to back so the hoover only comes out once.",
  },

  {
    id: "hall-hoover", name: "Hoover hallway", area: "Hallway",
    freq: 1, phase: 0, owner0: 1, replaces: ["floor-hall", "floorsbh"], minutes: 10,
    kit: ["Hoover with crevice tool"],
    steps: [
      "Move shoes and bags off the floor and lift the doormat.",
      "Hoover, using the crevice tool along the skirting and into the corners.",
      "Shake the doormat outside and put everything back.",
    ],
    tip: "The hallway hoover is always the same person's as the bathroom floor that week. Do them back to back so the hoover only comes out once.",
  },

  // ───────── Fortnightly ─────────
  {
    id: "living", name: "Tidy & dust", area: "Living area",
    freq: 2, phase: 0, owner0: 1, minutes: 25,
    kit: ["Dry microfibre cloth", "Damp cloth", "A basket for strays"],
    steps: [
      "Reset the room: anything that lives in a bedroom goes in the basket by its owner's door, and mugs go to the sink.",
      "Fold throws, plump cushions, clear the coffee table and stack the post.",
      "Dust from high to low: shelves, record shelf and speaker tops, lamp, windowsills.",
      "Wipe the TV with a dry microfibre cloth only. Sprays and wet cloths damage screen coatings.",
      "Wipe the coffee table and side tables with the damp cloth, then dry them.",
    ],
    tip: "Do this before that week's floors if you can, so the dust you knock down gets hoovered up.",
  },
  {
    id: "fridge", name: "Fridge clear-out", area: "Kitchen",
    freq: 2, phase: 0, owner0: 0, minutes: 30,
    kit: ["Warm water with washing-up liquid", "Clean cloth", "Tea towel", "Bin bag"],
    steps: [
      "Best done just before a food shop, when the fridge is emptiest.",
      "Bin anything mouldy or past its use-by date. If it's clearly the other person's and you're not sure, message them first.",
      "Wipe the shelves and drawers with the soapy cloth, taking out any that come out easily.",
      "Dry everything, including the rubber door seal, where mould likes to start.",
      "Put food back with the oldest at the front.",
    ],
    tip: "The Food Standards Agency advises keeping the fridge at 5 °C or below.",
  },
  {
    id: "linens", name: "Towels, bath mat & throws wash", area: "Whole flat",
    freq: 2, phase: 0, owner0: 1, minutes: 15,
    kit: ["Laundry detergent", "Fresh hand towel and bath mat"],
    steps: [
      "Gather the shared fabrics: bathroom hand towel, bath mat, the week's tea towels, and the sofa throws, which collect cat hair.",
      "Wash towels and tea towels at 60 °C. Wash the bath mat and throws at whatever their labels say, usually 40 °C.",
      "Dry a half load at most in the washer-dryer, because it dries badly when packed full.",
      "Put fresh ones out straight away and fold the rest.",
    ],
  },
  {
    id: "hallway", name: "Tidy & wipe", area: "Hallway",
    freq: 2, phase: 0, owner0: 0, minutes: 15,
    kit: ["Antibacterial spray", "Cloth", "Bag for recycling"],
    steps: [
      "Pair up and rack the shoes, hang up coats, and take anything that's drifted there back to its room.",
      "Sort the post: recycle junk mail and put each person's post where they'll see it.",
      "Spray a cloth (never the switch itself) and wipe the light switches, the front door handle and the area around it, and any hallway cupboard handles.",
      "Wipe the inside of the front door and the doormat area.",
    ],
  },

  {
    id: "mop-hall", name: "Mop hallway", area: "Hallway",
    freq: 2, phase: 1, owner0: 1, replaces: ["floor-hall", "floorsbh"], minutes: 15,
    kit: ["Mop and bucket", "Ecoleaf hard floor cleaner"],
    steps: [
      "Hoover first if that week's hallway hoover isn't done yet.",
      "Mix the floor cleaner at the label dose (60 ml in 5 litres of lukewarm water).",
      "Wring the mop hard, because the boards are laminate and swell if water sits in the joints. Work from the far end back towards wherever you're finishing.",
      "Put the doormat and shoes back once it's dry.",
    ],
  },

  // ───────── Every 4 weeks ─────────
  {
    id: "kettle", name: "Descale kettle", area: "Kitchen",
    freq: 4, phase: 1, owner0: 1, minutes: 10,
    kit: ["Kettle descaler or citric acid (or white vinegar)"],
    steps: [
      "Half-fill the kettle with water and add descaler or citric acid as the packet says. Equal parts water and white vinegar also works.",
      "Boil it, then leave it for 30 minutes.",
      "Empty, rinse well, then boil fresh water twice and pour it away so nothing tastes odd.",
      "Wipe the outside and the base.",
    ],
    tip: "With hard London water, if you see flakes in your tea before this comes round, do it early.",
  },
  {
    id: "washer", name: "Washer-dryer care", area: "Kitchen",
    freq: 4, phase: 3, owner0: 0, minutes: 30,
    kit: ["Old towel and a shallow tray", "Old toothbrush", "Washing machine cleaner (or the drum-clean programme)"],
    steps: [
      "Pull the detergent drawer all the way out (most have a release tab), rinse it under hot water and brush out the gunk. Brush the slot it sits in too.",
      "Fold back the rubber door seal and wipe out fluff, hair, coins and any black mould.",
      "Clean the drain filter: lay the towel and tray down, open the small hatch at the bottom front, and unscrew the filter slowly, because water will come out. Clear the debris and screw it back tightly.",
      "If your model has a lint filter for the dryer, clean it now. Check the manual: some washer-dryers self-clean their condenser.",
      "Run an empty drum-clean programme, or a 90 °C wash with washing machine cleaner.",
      "Leave the door and drawer ajar afterwards so the inside dries out.",
    ],
  },
  {
    id: "bathdeep", name: "Limescale & plughole", area: "Bathroom",
    freq: 4, phase: 3, owner0: 1, minutes: 30,
    kit: ["Limescale remover or white vinegar", "A sandwich bag and elastic band", "Drain hair tool", "Old toothbrush", "Rubber gloves"],
    steps: [
      "Shower head: fill a sandwich bag with limescale remover or vinegar, tie it around the head so the nozzles are submerged, and leave it 30 minutes while you do the rest.",
      "Pull the hair out of the bath plughole and sink plughole with the drain tool (gloves on), then run hot tap water for a minute.",
      "Scrub the build-up around the base of the taps and the plughole rims with the toothbrush.",
      "Check the grout and the silicone around the bath. If there's black mould, see the tip below.",
      "Take the bag off the shower head, scrub the nozzles with the toothbrush, and run the shower to flush it through.",
    ],
    tip: "For black mould on silicone, use a mould spray on a separate day from the limescale remover. Spray, leave as the label says, then rinse well.",
    safety: "Limescale remover and mould spray (usually bleach-based) must never be used together.",
  },
  {
    id: "windows", name: "Windows, sills & mould check", area: "Whole flat",
    freq: 4, phase: 1, owner0: 0, minutes: 30,
    kit: ["Glass cleaner", "2 microfibre cloths", "Mould spray"],
    steps: [
      "Spray glass cleaner onto the cloth rather than the glass, and clean the inside of the shared windows top to bottom. Polish with the dry cloth.",
      "Wipe the windowsills and frames.",
      "Check the rubber window seals and corners for black mould, which winter condensation causes. Wipe it away, and use mould spray if it doesn't shift.",
    ],
    tip: "Opening the windows for 10 minutes each morning in winter cuts down condensation a lot.",
  },

  // ───────── Every 8 weeks ─────────
  {
    id: "extractor", name: "Extractor hood filters", area: "Kitchen",
    freq: 8, phase: 4, owner0: 1, minutes: 30,
    kit: ["Washing-up liquid", "Bicarbonate of soda", "Washing-up brush", "Degreaser spray"],
    steps: [
      "Switch the hood off and unclip the metal grease filters from underneath.",
      "Soak them in the sink in the hottest tap water with washing-up liquid and two spoons of bicarb for 15 minutes, then scrub with the brush.",
      "While they soak, spray the hood's underside and outside with degreaser and wipe it clean.",
      "Rinse the filters and let them dry completely before clipping them back in.",
    ],
    tip: "If the hood recirculates air rather than venting outside, it also has a charcoal filter. That can't be washed: replace it every 3–6 months.",
  },
  {
    id: "skirting", name: "Skirting, switches & radiators", area: "Whole flat",
    freq: 8, phase: 4, owner0: 0, minutes: 40,
    kit: ["Hoover with brush tool", "Antibacterial spray", "Cloths"],
    steps: [
      "Hoover the skirting boards in the shared areas with the brush tool, then go over them with a damp cloth.",
      "Spray a cloth and wipe every light switch and door handle in the shared areas, plus the door frames where hands go.",
      "Hoover the tops of the radiators and down behind them. Dust there burns and smells once the heating's on.",
    ],
  },

  // ───────── Every 12 weeks ─────────
  {
    id: "oven", name: "Oven clean", area: "Kitchen",
    freq: 12, phase: 9, owner0: 1, minutes: 60,
    kit: ["Bicarbonate of soda", "White vinegar in a spray bottle", "Rubber gloves", "Scourer", "Dishwasher tablet or bio washing powder"],
    steps: [
      "Start in the evening, because the paste works overnight. The oven must be off and cold.",
      "Take out the racks and trays and soak them in the bath or sink in hot water with a dishwasher tablet or a scoop of bio washing powder.",
      "Mix bicarb with a little water into a spreadable paste. Wearing gloves, coat the inside of the oven and the door glass, keeping it off the heating element and the fan.",
      "Leave it at least a few hours, ideally overnight.",
      "Wipe the paste out with a damp cloth. Spray vinegar on what's left, which fizzes and lifts the rest, then wipe again until clean.",
      "Scrub the soaked racks, rinse, dry and put them back. Run the oven empty for 10 minutes to dry it.",
    ],
  },
  {
    id: "freezer", name: "Defrost freezer", area: "Kitchen",
    freq: 12, phase: 9, owner0: 0, minutes: 45,
    kit: ["Cool bag or a box with a blanket", "Old towels", "Bowl of hot water", "Plastic spatula", "Cloth"],
    steps: [
      "First check: if the ice is thinner than about 5 mm and the drawers slide freely, just wipe it and tick it off.",
      "Otherwise, run the food down for a few days beforehand. On the day, pack what's left tightly in a cool bag.",
      "Switch the freezer off at the wall, prop the door open, and lay towels on the floor and bottom shelf.",
      "Put a bowl of hot (not boiling) water inside and close the door for 10 minutes to speed up the melt. Ease loose ice away with the plastic spatula; never use a knife, which can puncture the cooling pipes.",
      "Once it's clear, wipe it out with warm soapy water, dry it thoroughly, and switch it back on.",
      "Wait about an hour for it to get cold before putting the food back.",
    ],
  },

  // ───────── Joni (always Jimmy's, not alternated) ─────────
  {
    id: "joni-week", name: "Bowls, litter top-up & cat hair", area: "Joni",
    freq: 1, phase: 0, owner0: 0, fixed: 0, minutes: 15,
    kit: ["Litter scoop", "Cat litter", "Lint roller", "Hot soapy water"],
    steps: [
      "Through the week: scoop the litter tray every day and refresh water daily.",
      "Once this week: wash the food and water bowls properly in hot soapy water.",
      "Top up the litter to the usual depth and sweep up any scattered litter around the tray.",
      "Lint-roll cat hair off the sofa and cushions.",
    ],
  },
  {
    id: "joni-litter", name: "Full litter change & tray wash", area: "Joni",
    freq: 2, phase: 0, owner0: 0, fixed: 0, minutes: 15,
    kit: ["Fresh litter", "Bin bag", "Unscented washing-up liquid", "Rubber gloves"],
    steps: [
      "Tip all the old litter into a bin bag, tie it off and take it down to the communal bins.",
      "Wash the tray with hot water and unscented washing-up liquid, rinse well and dry it.",
      "Refill with fresh litter.",
    ],
    safety: "Avoid bleach, disinfectants containing phenols (many pine or 'black fluid' types) and strongly scented cleaners on the tray: they are toxic or off-putting to cats.",
  },
];

export const FREQ_LABEL: Record<number, string> = { 1: "Weekly", 2: "Fortnightly", 4: "Every 4 weeks", 8: "Every 8 weeks", 12: "Every 12 weeks" };
