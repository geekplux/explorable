# Launch kit

**Nothing in this file has been posted anywhere.** Everything below is a draft for the maintainer to edit and post by hand after the public release. No agent posts, schedules or submits any of it.

## 1. Drafts

### Show HN (DRAFT — do not post)

**Title** (75 characters): Show HN: Explorable – paste a paper, get an essay with figures you can drag

**Post:**

> I keep finishing abstracts with the feeling that I would understand the idea if I could poke at it. Bartosz Ciechanowski's and Amelia Wattenberger's essays show how good that can be, but each one takes weeks by hand.
>
> explorable is my attempt at the 90% version, for one idea at a time. Paste an arXiv or blog link and you get a short scrolling essay with two or three live figures. Each figure has a knob, and every number on it comes from a small, unit-tested model of the idea, not from a screenshot or a canned animation.
>
> Some design choices you might care about:
>
> - At most one LLM call per new link (Workers AI), cached in KV. The model only picks the core idea, writes the prose and chooses figures and parameters as schema-checked JSON. It never writes code that runs: figures come from a small kit of tested components, and formulas go through our own expression parser, with no eval.
> - The three built-in samples (attention's √d, Bloom filters, diffusion noise) work offline with no key.
> - Accessibility is part of done: keyboard-operable knobs, a live text description and a data table for every figure, colour-vision-checked palette, reduced motion.
> - The same kit ships as an agent skill: one command, and your coding agent can write a standalone, offline HTML explorable for a concept.
>
> It is MIT-licensed, React + Vite and one Cloudflare Worker. I'd love to hear which papers break it.
>
> Demo: https://explorable.geekplux.com · Code: https://github.com/geekplux/explorable

### X thread (DRAFT — do not post)

1. Paste an arXiv link, get its core idea back as a short essay with figures you can drag. Every number comes from a real, tested model of the idea. Open source: explorable. [hero image]
2. Why attention divides by √d, as something you can touch: drag the temperature and watch six softmax bars collapse into one spike, with the entropy readout updating every frame. [short clip]
3. The rule: one AI call per new link, at most. The model picks the idea and the figures as JSON; it never writes code that runs. The figures come from a small, tested kit.
4. Samples work offline with no key. Every knob works from the keyboard, every figure has a live text description and a data table, and colour never carries meaning alone.
5. For coding agents: one command installs the /explorable skill, which builds a standalone offline HTML explorable for any concept. MIT. https://github.com/geekplux/explorable

## 2. Demo scenarios

**A student reading the attention paper.** Priya is halfway through "Attention Is All You Need" and stuck on why the scores are divided by √d_k. She opens the demo and clicks *Why attention divides by √d*. In the first figure she drags the temperature down and watches "cat" take nearly all of the weight. In the second she widens the vectors with the scaling off and sees the softmax spike again, then turns the √d_k switch on and it relaxes. Under a minute, no install, and the sentence in the paper now means something.

**A writer adding a Bloom filter figure to a post.** Sam is writing a post on caching and wants one honest interactive figure. In Claude Code they ask `/explorable explain how a Bloom filter trades memory for false positives`. The agent starts from the skill's `bloom-filter` example, writes `explorable.json`, builds one standalone HTML page and runs the audit until it prints `audit passed`. Sam embeds the page in the post; it works offline, and readers can insert words and watch the false-positive rate climb.

**A self-hoster running without AI.** Lee runs a reading group and wants a copy on their own Cloudflare account, without paying for or configuring an AI model. They deploy without the AI binding. The samples work, typed topics search the samples locally, and links about attention, Bloom filters or diffusion reuse the matching curated essay with the right source. Any other link shows the extracted title and abstract with a clear "AI unavailable" note instead of a blank page.

## 3. How it compares

An honest view of what each option gives the reader. explorable is not the best at everything: it trades breadth for figures you can trust.

| | Static diagram | Hand-built D3 / Observable notebook | Generic "chat with PDF" tool | LLM-generated free-form code | explorable |
|---|---|---|---|---|---|
| Reader can move the key parameter | no | yes | no | sometimes | yes |
| Numbers come from a tested model | n/a | if the author tests it | no | rarely | yes, unit-tested fixtures |
| Time to a figure for a new paper | minutes to hours | days to weeks | seconds | seconds to minutes | seconds (or instant for samples) |
| Range of ideas it can show | anything drawable | anything | anything as text | anything, unreliably | what the kit's models and formulas cover |
| Safe to run | yes | yes | yes | runs untrusted code | yes, no generated code runs |
| Keyboard and screen-reader support | alt text at best | up to the author | text only | rarely | built in, tested |
| Works offline, no key | yes | often | no | depends | samples and skill pages: yes |
| Craft and narrative | up to the author | the best when done well | none | uneven | short, templated essay |

Where the others win: a hand-built notebook by a skilled author is richer and more original than anything templated, a chat tool answers arbitrary questions about the whole paper, and free-form code can draw ideas our kit has no model for.

## 4. Pre-launch checklist

- [x] Deployed (Workers Builds from `main`), and the live demo link, https://explorable.geekplux.com, is in the README and in these drafts.
- [ ] Repository is public; the description and topics are set (explorable-explanations, interactive, visualization, react, vite, cloudflare-workers, agent-skill).
- [ ] `public/social-preview.png` uploaded by hand in the repository settings (Settings → General → Social preview).
- [ ] `.github/workflows/ci.yml` green on `main`.
- [ ] `pnpm check`, `pnpm build`, `pnpm smoke`, `pnpm e2e` and `pnpm build:examples` all pass on a fresh clone; the README quick start works as written, including the `npx degit` skill command.
- [ ] Every sample opens on a phone, a desktop and with a screen reader; reduced motion checked.
- [ ] A handful of real arXiv and blog links tried on the live demo, with failures turned into issues or good-first-issues.
- [ ] Rate limit and KV cache confirmed on the live Worker.
- [ ] CHANGELOG has a first release section and a tag.
- [ ] Good-first-issues from `docs/GOOD_FIRST_ISSUES.md` filed as GitHub issues with the label.
- [ ] Drafts above reread, edited and posted by the maintainer, by hand.
