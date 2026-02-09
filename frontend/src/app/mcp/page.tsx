import {
  BookOpen,
  Link as LinkIcon,
  Lock,
  Server,
  TerminalSquare,
  Wrench,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const tools = [
  "list_subscriptions",
  "get_subscription",
  "create_subscription",
  "update_subscription_status",
  "delete_subscription",
];

export default function McpPage() {
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-2">
        <Server className="w-6 h-6" />
        <h1 className="text-2xl font-bold">MCP Server</h1>
      </div>

      <p className="text-sm text-muted-foreground">
        NAS Tools exposes an MCP server so AI clients can read and manage subscriptions.
      </p>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="py-0">
          <CardHeader className="border-b py-4">
            <CardTitle className="flex items-center gap-2 text-base">
              <LinkIcon className="w-4 h-4" />
              Endpoint
            </CardTitle>
            <CardDescription>Use the backend MCP route with streamable HTTP transport.</CardDescription>
          </CardHeader>
          <CardContent className="py-5">
            <pre className="rounded-md border bg-muted/40 p-3 text-xs overflow-x-auto">
{`URL: http://<nas-tools-host>:3001/mcp
Transport: Streamable HTTP`}
            </pre>
          </CardContent>
        </Card>

        <Card className="py-0">
          <CardHeader className="border-b py-4">
            <CardTitle className="flex items-center gap-2 text-base">
              <Lock className="w-4 h-4" />
              Authentication
            </CardTitle>
            <CardDescription>Remote requests require your API token.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 py-5 text-sm">
            <p>
              Add this header when your client is outside your local/private network:
            </p>
            <pre className="rounded-md border bg-muted/40 p-3 text-xs overflow-x-auto">
{`Authorization: Bearer <api_token>`}
            </pre>
            <p className="text-muted-foreground">
              You can set or rotate the token in <span className="font-medium">Settings</span>.
            </p>
          </CardContent>
        </Card>

        <Card className="py-0">
          <CardHeader className="border-b py-4">
            <CardTitle className="flex items-center gap-2 text-base">
              <Wrench className="w-4 h-4" />
              Available Tools
            </CardTitle>
            <CardDescription>The MCP server currently exposes these operations.</CardDescription>
          </CardHeader>
          <CardContent className="py-5">
            <ul className="space-y-2 text-sm">
              {tools.map((tool) => (
                <li
                  key={tool}
                  className="rounded-md border px-3 py-2 font-mono text-xs bg-muted/20"
                >
                  {tool}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card className="py-0">
          <CardHeader className="border-b py-4">
            <CardTitle className="flex items-center gap-2 text-base">
              <BookOpen className="w-4 h-4" />
              Setup Flow
            </CardTitle>
            <CardDescription>Recommended integration steps.</CardDescription>
          </CardHeader>
          <CardContent className="py-5">
            <ol className="list-decimal pl-4 space-y-2 text-sm">
              <li>Start NAS Tools backend and make sure port `3001` is reachable.</li>
              <li>Add the MCP server URL (`/mcp`) in your MCP-compatible client.</li>
              <li>Configure `Authorization` header if the client is outside LAN.</li>
              <li>Run a tool listing call and verify the tools shown above are returned.</li>
            </ol>
          </CardContent>
        </Card>

        <Card className="py-0 md:col-span-2">
          <CardHeader className="border-b py-4">
            <CardTitle className="flex items-center gap-2 text-base">
              <TerminalSquare className="w-4 h-4" />
              Client Config Example
            </CardTitle>
            <CardDescription>Example MCP client config with streamable HTTP transport.</CardDescription>
          </CardHeader>
          <CardContent className="py-5">
            <pre className="rounded-md border bg-muted/40 p-3 text-xs overflow-x-auto">
{`{
  "mcpServers": {
    "nas-tools": {
      "url": "http://<nas-tools-host>:3001/mcp",
      "headers": {
        "Authorization": "Bearer <api_token>"
      }
    }
  }
}`}
            </pre>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
