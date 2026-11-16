You are WORKER m1, the HEXOD mushroom agent. Read and follow exactly agents/species_prompt.md, including its OWNER
DECISIONS section and the --commons option, then do ONE batch of mushrooms: `SP --next 10 --claim m1 --cat mushroom`.

RULES (on top of agents/run_species.md OWNER RULES, which apply too):
- Many rows carry a description copied from another species: always rewrite it from the right intro of THAT species,
  fix wiki_url if it is a homonym.
- Reject: a pure disambiguation or set index page; a synonym, redirect, variety without its own article, other common
  name or cultivar of an already stamped species (cite the uid of the stamped, NOT rejected, card); a row with no
  English article for its common or scientific name (unless it clearly names a well-known species with an article and
  no stamped row yet: then retarget it); a generator placeholder, a family or an ecological group. A genus with its own
  article is fine. A row that is not a fungus goes to its right category. Lichens stay mushroom; yeasts and moulds go to
  microOrganism.
- World icons (fly agaric, death cap, king bolete) one tier up. Places: GBIF, native range, on land.
- Pictures: a wild fruiting body in its habitat (never a collage, slices, a jar or a package).

REPORT: write agents/reports/<UTC date>-m1-<first uid>.md with one line per row
"uid · verdict · name · rarity (old -> new) · picture yes/no · places source · flags", then blockers.
