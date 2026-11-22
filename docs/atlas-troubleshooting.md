# Troubleshoot the Atlas connection

Run the server from the `Suno-` folder. The current app reads the project’s `.env` before connecting to MongoDB. `npm start` reports a startup failure if it cannot connect. Once the server is listening, [database health](http://127.0.0.1:8000/api/health) checks its current connection.

| Symptom | Check |
| --- | --- |
| The terminal asks you to set `MONGODB_URI` | Copy `.env.example` to `.env` if needed and replace the placeholders with the Atlas driver URI. |
| Atlas rejects authentication | Use a database user from the same Atlas project. URL-encode reserved characters in the password and confirm the user has access to the database selected by `MONGODB_DB_NAME`. |
| The server stalls or reports a network error | Confirm the cluster is active and the computer's current public IP has an active entry in Atlas Network Access. Verify outbound TCP port `27017` on the replica hostnames. |
| TCP connects but TLS fails | Compare with an authorized second network and gather the TLS error code for the network administrator or Atlas support. Leave certificate validation enabled. |
| Home opens but health returns 503 | The server lost its MongoDB connection after startup. Check whether the cluster is reachable from the current network. |

On Windows, `Resolve-DnsName -Type SRV _mongodb._tcp.<cluster-host>` lists the replica endpoints. Use `Test-NetConnection -ComputerName <replica-host> -Port 27017` for each one. A successful TCP test alone does not verify TLS or database authentication.

For a support request, capture the time, network used, hostname, port, and error code. Omit the username, password, and full URI. See the [Atlas connection troubleshooting guide](https://www.mongodb.com/docs/atlas/troubleshoot-connection/).
