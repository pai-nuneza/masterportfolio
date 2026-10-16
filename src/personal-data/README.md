# Personal data

Everything the hire assistant (the robot chat in the corner) knows about you lives in these JSON files.
Edit them, run `npm start` to check, and the assistant picks the changes up. No code changes needed.

The assistant answers in three ways (no AI service; nothing is made up):

- **Quick replies** (the buttons in the chat) always give their topic's answer from `topics.json`.
- **Familiar questions get a written answer** built from your experience
  (`src/app/resume/experience/experience.data.ts`) and projects (`src/assets/data/projects-enhanced.json`):
  "Has Pai used Angular?", "Which projects used MySQL?", "What did Pai do at Codev?", "How long was Pai there?",
  "Where does Pai work now?", "Which companies has Pai worked for?", "Tell me about PPSTA". It follows up
  ("What about Vue?", "Where?", "Tell me more") and fixes small typos ("anguler"). The wording is in
  `chat.json` → `phrases`.
- **Anything else is searched** across `topics.json`, `knowledge.json`, experience and projects, and the best
  match is shown. If nothing matches, it says so and lists what it can answer.

## Files

| File | What it holds |
|---|---|
| `contact.json` | Name, email, phone, location and profile links. Leave `messenger` empty to hide the Messenger button. |
| `links.json` | The buttons shown under answers. `href` can use `{placeholders}` from `contact.json`. |
| `hours.json` | Your time zone and usual call hours (`pai`), and what counts as a visitor's normal day (`visitor`). |
| `topics.json` | Curated FAQ answers. Topics with a `label` also appear as quick-reply buttons. |
| `knowledge.json` | Extra facts the assistant can find when someone types a question (about you, how you work, etc). |
| `chat.json` | The greeting, the "couldn't find that" reply, the "What can I ask?" list, bubble text, synonyms, and `phrases` (the wording of written answers; each has a few variations picked at random). |
| `skills.json` | `mainStack` (also shown on the home page), `notListed` (technologies people may ask about that you don't list, for honest "not listed" replies; move one into your experience if you do use it), and `notTechnologies` (skills in your experience that aren't technologies, like "Team Leadership"). |

## Placeholders

In answers and links, `{key}` is replaced with that value from `contact.json`, e.g. `{email}`, `{phone}`,
`{location}`. Add `:url` to URL-encode it, e.g. `viber://chat?number={phoneDigits:url}`.

## Topics (`topics.json`)

```json
{
  "label": "Rates",                       // optional: makes it a quick-reply button
  "question": "What are Pai's rates?",    // shown as the visitor's message when the button is used
  "keywords": ["rates", "budget"],        // extra words that should find this answer
  "answer": ["One paragraph per line."],
  "links": ["email", "form"],             // names from links.json
  "timePlanner": true                     // optional: adds the "Compare times" planner button
}
```

## Knowledge (`knowledge.json`)

Add anything a client might ask that isn't a whole FAQ topic: education, certifications, languages you speak,
hobbies, notable achievements...

```json
{
  "title": "Languages",
  "text": ["Pai speaks English and Filipino."],
  "keywords": ["language", "speak", "english"],
  "links": ["about"]
}
```

## If a question gets the wrong answer

- Add the visitor's word to the right entry's `keywords` (titles and keywords count most in the search).
- For words that mean the same thing ("cv" and "resume"), add them to `synonyms` in `chat.json`.

Hours use the 24-hour clock in your own time zone; days are `0` = Sunday to `6` = Saturday.
JSON doesn't allow comments: the `//` notes above are only for this README.
