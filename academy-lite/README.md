# M-PESA Academy Lite

A light, phone-first way to take M-PESA trainings, built on the patterns people already use every day:

- **Home** is a vertical short-video feed. Swipe up post by post through videos, swipeable slides, one-tap quizzes and tips. Buttons on the right let you follow the trainer, like, comment, save and share. Tabs at the top switch between **My learning** (your courses in order, ending with a certificate) and **For you** (everything mixed). **LIVE** shows live sessions and **Search** finds courses, topics and #tags. Double-tap anything to like it.
- **Community** is a social feed: classmates' stories, a "What did you learn today?" post box, and posts with likes, comments and shares.
- **Inbox** is a chat app: trainers, class groups and the Academy announcements channel, with unread badges, ticks, voice notes and shared posts. Trainers reply in the demo.
- **Profile** shows a cover, avatar and stats, your streak and level, and a grid of your courses, saved posts, certificates and liked posts.
- The **middle button** carries on from the next post you haven't seen.

## Run it

It uses the main project's installed packages and `public/` folder, so install the main project once (`npm install` in the folder above), then:

```bash
npm run dev
```

It opens at http://localhost:5180. From the main project folder you can also run `npm --prefix academy-lite run dev`.

## Where things are

| File | What it holds |
| --- | --- |
| `src/data.ts` | Courses and their posts, trainers, chats, community posts and live sessions |
| `src/store.tsx` | What the learner does (likes, saves, progress, quiz answers, XP, streak, chats), kept in the browser |
| `src/feed.tsx` | The vertical feed and every post type |
| `src/sheets.tsx` | Comments, share, course list, live sessions and search |
| `src/inbox.tsx`, `src/community.tsx`, `src/profile.tsx` | The other tabs |

Everything is demo data stored in the browser. **Profile → menu → Reset demo data** starts over.
