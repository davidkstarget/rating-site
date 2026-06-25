# Classroom Rating Site

Live classroom voting for student ideas. The teacher projects the admin scoreboard, students scan the QR code, enter a RUNI `@post.runi.ac.il` email, and vote 1-5 stars for each idea.

## Local Run

```bash
npm install
cp .env.example .env
npm start
```

Open `http://localhost:3000/admin`.

Default local PIN from `.env.example` is `2468`. Change `ADMIN_PIN` in `.env` before class if you want a different code.

## Classroom Flow

1. Open `/admin` on the laptop connected to the projector.
2. Enter the admin PIN.
3. Set the number of students/ideas, from 1 to 40.
4. Students scan the QR code and enter their `@post.runi.ac.il` email.
5. Start each idea after the student finishes presenting.
6. Voting closes after 20 seconds or when every expected student has voted.
7. The projected screen reveals the average rating immediately.
8. End the session to show the final top 10.

## Voting Rules

- The student count and idea count are the same value.
- Ideas are numbered in order.
- Each normalized email can vote once per idea.
- Re-voting before the idea closes replaces the earlier vote.
- Rankings sort by average rating, then vote count, then lower idea number.
- Data is stored in memory and is cleared when the server restarts or the admin resets the session.

## Render Deployment

This repo includes `render.yaml` for a single free Node web service.

1. Push the repository to GitHub.
2. In Render, create a Blueprint from the GitHub repo.
3. Set `ADMIN_PIN` when Render asks for the secret value.
4. Deploy.
5. Open the Render URL before class so the free service is awake.

## Checks

```bash
npm test
render blueprints validate
```
