import { Octokit } from "octokit";
import express from "express";
import { Readable } from "node:stream";

const app = express()

app.post("/", express.json(), async (req, res) => {
  // Identify the user, using the GitHub API token provided in the request headers.
  const tokenForUser = req.get("X-GitHub-Token");
  const octokit = new Octokit({ auth: tokenForUser });
  const user = await octokit.request("GET /user");

  // Get public, non-archived github repositories
  const repos = await octokit.paginate(`GET /orgs/github/repos`, {
    org: 'github',
    headers: {
      'X-GitHub-Api-Version': '2022-11-28'
    },
    per_page: 100,
    type: 'public'
  })
  // console.log('Repos name:', JSON.stringify(repos[0].full_name))
  // console.log('Repos description:', JSON.stringify(repos[0].description))

  // console.log(Object.keys(repos).length)
  const results = repos.reduce((acc, { full_name, description, archived }) => {
    if(archived === false) {
      acc[full_name] = description;
    }
    return acc;
  }, {});
  // console.log(Object.keys(result).length)

  // console.log('Test: Nil');
  // console.log("User:", user.data.login);

  // Parse the request payload and log it.
  const payload = req.body;
  // console.log("Payload:", payload);

  // Provide LLM with instructions for responding to user request
  const messages = payload.messages;
  messages.unshift({
    role: "system",
    content: `You are a assistant that helps the user find the repository that most fits what they're looking for.`,
  });
  messages.unshift({
    role: "system",
    content: `These are the repositories you can select from ${JSON.stringify(results)}. You should always return the results as one bullet point per repository and always include links to the repositories.`
  });
  messages.unshift({
    role: "system",
    content: `Start every response with the user's name, which is @${user.data.login}.`,
  });

  const copilotLLMResponse = await fetch(
    "https://api.githubcopilot.com/chat/completions",
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${tokenForUser}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        messages,
        stream: true,
      }),
    }
  );

  // Stream the response straight back to the user.
  Readable.from(copilotLLMResponse.body).pipe(res);
})

const port = Number(process.env.PORT || '3000')
app.listen(port, () => {
  console.log(`Server running on port ${port}`)
});