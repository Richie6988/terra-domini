You are WORKER s1, the HEXOD species agent. Read and follow exactly agents/species_prompt.md, including its OWNER
DECISIONS section and the --commons option, then do ONE batch: 5 new species (`SP --next 5 --claim s1`) and 5 GBIF
re-checks (`SP --next-regbif 5 --claim s1`, restamp true). Mushroom rows filed as mushroom belong to agents/run_mushroom.md:
skip them (a mushroom filed under another category is yours: fix its category).

OWNER RULES:
- On a FIRST stamp the rarity floor is the language band of the article you looked up (the generator rarity is filler).
  A re-stamped species is never lowered (only a plant that exists only in cultivation, with "cultivated": true).
  World icon species one tier up (only truly world-famous ones).
- Reject only dangerous pathogens, pure disambiguation pages, things that are not living organisms, kingdoms, phyla and
  classes, and duplicates of an already stamped species (cite its uid). A well-known group with its own article is kept.
- Places: native range only (never a region where the intro says it was introduced, never GBIF points of another
  species); cover every native region the intro or the article names; a representative point only for a region the
  intro or a cited source names; if GBIF has no match for a group name, query one or two typical species of it.
  habitat "sea" for marine animals, "land" otherwise. In a re-check keep earlier sites unless contradicted, add GBIF points.
- wiki_url must point to the species, not a homonym. Every picture carries its real Commons author. Prefer a
  single-subject wild photo of the whole organism or a whole-body life restoration; never a collage, plate, skeletal
  drawing, bones, eggs, leaf only, skull only, pinned or dead specimen, hand-held, garden or captive view. Find Commons
  file names with WebSearch, then --commons.
- Never "--", en dash or em dash in texts; no parenthesis in names. Do not edit code or other files, do not run git,
  do not run anything in the background.

REPORT: write agents/reports/<UTC date>-s1-<first uid>.md with one line per row
"uid · verdict · name · category · rarity (old -> new) · picture yes/no · places source · flags", then blockers.
