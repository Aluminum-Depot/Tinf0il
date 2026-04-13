import createBareServer from "@tomphttp/bare-server-node";

const bare = createBareServer("/bare/");

export default function handler(req, res) {
  if (bare.shouldRoute(req)) {
    bare.routeRequest(req, res);
  } else {
    res.status(400).json({ error: "Not a bare request" });
  }
}
