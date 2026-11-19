# Pub Golf

Live scores, course map, rules, teams and a team cost tab for Jack's birthday pub golf on Saturday 16 January 2027.

The page is static and served by GitHub Pages. Scores and everything else live in a Google Sheet, with an Apps Script web app in front of it.

## Working on it

- `npm test` runs the rule and server tests.
- `npm run dev` serves the page locally at http://localhost:4173 against made-up test data.

## Backend

The backend code is in `backend/` and is pushed to Apps Script with Google's clasp tool.

```
clasp push
clasp update-deployment <deployment id>
```

The deployment id is at the top of `js/api.js`. Updating that deployment keeps the web address the same.

Drinks, pubs, hazards and rule numbers are edited straight in the Sheet (Holes and Settings tabs), no code change needed.

## Privacy

Real names, photos and access links live only in the Sheet and in Drive. Never put them in this repo.
