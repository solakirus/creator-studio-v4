# Life tasks — sending to-dos from other apps into Creator Studio

Creator Studio v4 imports to-dos from Kris's other apps (Punch for the house,
the car app, Homebase for the family) so they can be filmed. Each app saves a
**life-tasks** file; Creator Studio opens it under
**Settings → Import from my other apps**.

## The file

```json
{
  "format": "life-tasks",
  "version": 1,
  "app": "Punch",
  "area": "home",
  "exportedAt": "2026-11-20T09:00:00Z",
  "tasks": [
    {
      "id": "t42",
      "title": "Re-caulk the tub",
      "date": "2026-11-22",
      "time": "09:00",
      "minutes": 90,
      "where": "Bathroom",
      "project": "Bathroom refresh",
      "notes": "Film the before and after",
      "steps": ["Scrape old caulk", "Clean", "Tape", "Caulk", "Pull tape"]
    }
  ]
}
```

- Only `title` is required.
- `id` should be the app's own id for the task and never change. For a task that
  repeats, add the date: `chore123@2026-11-22`. This is what stops duplicates.
- `area` is `home`, `car` or `family` (any other word makes a new area). If it's
  left out, Creator Studio guesses it from `app`.
- `date` is `YYYY-MM-DD`; no date puts it on today. `time` is 24-hour `HH:MM`
  (`9am` also works). `hours` works in place of `minutes`.
- Several apps can go in one file as an array of these objects.
- A CSV works too: columns `app, area, id, title, date, time, minutes, hours,
  where, project, notes, steps` (steps separated by semicolons). Rows starting
  with `#` are skipped.

## Duplicates

A task is skipped, not imported, when:

1. the same app's same `id` was imported before — even if it's since been
   finished or deleted in Creator Studio;
2. a task with the same title (ignoring case and punctuation) is already on the
   same day — including one typed in by hand;
3. it appears twice in the same file.

So sending the same file twice is always safe.

## In Creator Studio

Imported tasks are tagged with their area and app, can be marked as shoot
tasks, and Today shows focus chips (All · Creator · Home · Car · Family) to work
one part of life at a time.

## Status by app

| App | Export |
|---|---|
| Homebase | Done — Settings → Send tasks to Creator Studio (your chores and to-dos, or everyone's, 7/14/30 days) |
| Punch | To do — add a "Send to Creator Studio" button that writes this file (`area: home`) |
| Car app | To do — same, `area: car`, `project` = the vehicle |
