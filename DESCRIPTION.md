This is a pull request for my two months of research on how we can decentralize npm by not breaking any mainstream behavior, so we make it as easy as possible to adopt new paradigms by users without having to deal with new conventions or at least a inconvenient number of them.

> [“I have only made this letter longer because I have not had the time to make it shorter.”](https://www.goodreads.com/quotes/21224-i-have-only-made-this-letter-longer-because-i-have)

I'd avoid making this pull request description shorter, not because of time, but because i cannot hold my excitement any more than that. So forgive me for the obvious writing mistakes.    

I went through a journey of ideas. Initially I visualized this as a localhost server called denpm that would store its local url in `~/.npmrc` as `registry=http://denpm.local` and then from there it'd distribute the pacakge requests, mapping each package to a random registry, something like `npm add vite` would go through `denpm.local -> registry.npmjs.org`, `denpm.local -> registry.yarnpkg.com`, `denpm.local -> registry.npmmirror.co`, `denpm.local -> r.cnpmjs.org` or perhaps any other registry the user might want to provide.

This is totally possible due to the nature of redirects in npm. So `npm add vite --registry=http://denpm.local` would result into this `package-lock.json` if the localhost server decides to just redirect the request to `registry.npmjs.org`. 

```json
    "node_modules/vite": {
      "version": "8.0.1",
      "resolved": "https://registry.npmjs.org/vite/-/vite-8.0.1.tgz",
      "integrity": "sha512-wt+Z2qIhfFt85uiyRt5LPU4oVEJBXj8hZNWKeqFG4gRG/0RaRGJ7njQCwzFVjO+v4+Ipmf5CY7VdmZRAYYBPHw==",
    }  
```

Before the redirect, the source, or the proxy server, which is in this case `denpm.local` can do a whole lot of stuff. It can check the signatures behind the package to make sure it hasn't been tampered or the destination server, the registry, the mirror, which is in this case `registry.npmjs.org`, does not serve the user something different than what it previously claimed through the signature. 

Or to stimulate decentralization, the proxy can just randomly assign each package to a distinct registry. This would potentially remove the single point of failure nature of npm and our overreliance on it. 

I'm bringing all of this just to mention that the possibility of opting out of the npm registry is there and unbelievably it's as simple as `npm config set registry http://denpm.local/`.

We all love npm and it's the giant everyone is standing on its shoulder, _BUT_ if there's an opportunity to ease the work for the npm servers, distribute the load being lifted, increase security and a whole lot of other stuff, then why not explore those wins?

The recent growth over npmx showed that all of this is possible as long as we make something smoother than what's available.     

The thing that striked me after researching denpm was that the golang ecosystem had nearly solved the package management issue through a mix of centralization and a lot of decentralization. So that led me to dig even more into how they did it and how they leveraged transparency logs to allow proxies act in an authentic manner. At that point I realized a new CLI is not only not enough, but it might be unncessary. 

So the biggest inspiration for this effort is the golang ecosystem. Centralization at that point would be part of npmx itselsf, specifically the Checksum database it'd maintain. Decentralization would be basically everything else, like the npm registry and other _registries_ and _mirrors_.

I keep separating registries and mirrors, though might there be a slight technical difference, but both should be advertised and users should know the difference between them and the fact that spinning up a new registry is way cheaper than spinning a full mirror.

The community might decide to maintain servers that are one-to-one replications of the npm registry itself or at least, or a portion of it.  That's what I'd call a mirror, like `registry.npmmirror.co` by [cnpm](https://github.com/cnpm/cnpmcore).

Registries are though more important, they might want to host exclusive packages. For instance, `registry.viteplus.dev` would decide to only host packages like vite or vitest only, or even better, their supply chain.

So registries for ownership and mirrors for distribution and obviously, mirroring. Imagine a world where each maintainer can host their own packages under their own domain if they prefer, which is totally possible, but hasn't been mainstream yet due to friction I'd argue.

That's where [VSR](https://www.vlt.sh/serverless-registry) or [Verdaccio](https://verdaccio.org) can join the effort as well to ease up the hosting side.

Back to the solution, in the next few sections I'll go in details around how the puzzle pieces are going to fit together. 

## Checksum Database

Something like `sum.npmx.dev`.

This is the point of centralization in the puzzle. It'd solve the problem of package unpublishes, mutability and version replacements in the new decentralized package management world. Two mirrors won't be able to ship different bytes for   the same version of the same package, if one acts unfaithfully, it'd be easily caught by what's already recorded in the checksum database. 

The initial and main consumer of this checksum database would be the npmx proxy, but after gaining momentum, it might be something that the package managers might want to rely on, independantly.

### Merkle Trees and Transparency Logs

More details in [Russ Cox's blog post](https://research.swtch.com/tlog). Briefly, this data structure would allow us to create a tamper-evident database so a released package would be cryptographically frozen and therefore cannot be tampered.   

And similar to the golang checksum database, we'd expose APIs that'd allow any user or service to verify the merkle tree we're hosting.

The checksum database itself allows for the auditability of registries and proxies. This data structure would allow the auditability for the checksum database itself.  
So it's not an unverifiable point of centralization but rather a totally verifiable and consistent one. 

## Proxy

`registry.npmx.dev` or `proxy.npmx.dev`. This the same url that the user would have to pass to `npm config set registry`.

It'd handle the job of redirects to the right registries, making sure that they serve the right content, returning [consistent manifests](https://blog.vlt.sh/blog/the-massive-hole-in-the-npm-ecosystem) and all the security improvments we can make over npm. 

In the current mvp, the proxy only allows project with the `integrity` field to be stored in the checksum database and returned to the user to increase the security. 
So packages with no `integrity` (not signed by the registry) are not allowed to be stored. This can be changed but it also means less security, even though we sign the each field in the checksum database too. 

### `/-/npm/v1/keys`

This what `npm audit signatures` use to audit the signatures of the packages and verify that we're consuming what the registry has actually signed.

```json
{
  "keys": [
    {
      "expires": "2025-01-29T00:00:00.000Z",
      "keyid": "SHA256:jl3bwswu80PjjokCgh0o2w5c2U4LhQAE57gj9cz1kzA",
      "keytype": "ecdsa-sha2-nistp256",
      "scheme": "ecdsa-sha2-nistp256",
      "key": "MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAE1Olb3zMAFFxXKHiIkQO5cJ3Yhl5i6UPp+IhuteBJbuHcA5UogKo0EWtlWwW6KSaKoTNEYL7JlCQiVnkhBktUgg=="
    },
    {
      "expires": null,
      "keyid": "SHA256:DhQ8wR5APBvFHLF/+Tc+AYvPOdTpcIDqOhxsBHRwC7U",
      "keytype": "ecdsa-sha2-nistp256",
      "scheme": "ecdsa-sha2-nistp256",
      "key": "MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEY6Ya7W++7aUPzvMTrezH6Ycx3c+HOKYCcNGybJZSCJq/fd7Qa8uuAKtdIkUQtQiEKERhAmE5lMMJhP8OkDOa2g=="
    }
  ]
}  
```

`registry.npmx.dev/-/npm/v1/keys` not only can host those keys by the npm registry, but all the keys from all other registries and mirrrors. 

I assume this file won't be hundreds of megabytes or even more, but if my assumption is wrong, we can cherry pick the keys we return to the user based on what registries they prefer in a potential dashboard using the `authorization` http header.

```
GET /-/npm/v1/keys HTTP/1.1
Host: registry.npmjs.org
user-agent: npm/10.2.4 node/v20.11.0 linux x64 workspaces/false
npm-session: b9c1d2e3f4a5b6c7        ← new random ID, new invocation
npm-command: audit
authorization: Bearer npm_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
accept-encoding: gzip, deflate, br
accept: */*
connection: keep-alive
if-none-match: "abc123etag"  
```

### The New world

By avoiding overdependence on the npm registry, new kind of registries and mirrors would emerge. One I keep dreaming of that'd mitigate most of attacks happening on npm, remind you that most attacks happen on npm LINK ARTICLE, is a `mirror.socket.dev` which would only host what's available on npm once it goes their in-house audits, which are pretty good. They have been able to catch most of the recent attacks on npm before anyone else, but still, since there's no way to affect user workflows directly, like through explicit errors and failures in `npm add` by avoiding to serve a particular package, a lot of potential is being missed.    

Another kind of registries I imagine are organization backed registries that host only what they ship or what they rely on, like the `registry.viteplus.dev` example mentioned above. That'd be the same story with maintainer backed registries, like `registry.roe.dev` hosting packages that Daniel maintains. 

## FAQ

I am adding these as prompts for myself. If the PR is going to persuade anyone, it should answer these directly instead of assuming the reader will fill the gaps for me.

### What exact npm failure modes am I trying to solve first?

I think the root problem is the extremely centralized characteristic of npm and consequently, our overreliance on it. Other issues like security, can be easily solved once we demonstrate a viable path to decentralization so any registry or mirror can decide to host their desired packages however they want with preferrable guardrails they want (e.g. running AI-powered security checks, 2FA).

The other problem that decentralization solves is the unsustainability of npm, which is perhaps why it's not receiving major upgrades or major changes and that's not npm's fault, this is the problem of serving data for free at the scale of npm and other registries. Decentralization would bring instances would host portions of npm, which would make it sustainable for them since they won't have to lift the load of the whole ecosystem, or they might decide to serve only the few packages they're willing to serve. 

### Which important npm security problems am I explicitly not solving in this PR?

The low-hanging fruits like verifying metadata, digests, integrity and also enforcing cryptographic authentication would be solved, since, they're low-hanging fruits and there's no harm in tackling them. The mvp already tackles implements thsoe guardrails partially for the sake of demonstration. But more importantly, decentralization itself does not solve any security issue and perhaps, most of the complex security issues npm and maintainers face like social engineering and account takeovers. But it rather stimulates the spin up of new mirrors and registries that would take those security concern into account like the `mirror.socket.dev` example above.
 
### What is the concrete win for users if they adopt this?

Opting out of the npm registry, whether partially or totally, as a lock-in solution.

### Why a proxy instead of a new CLI?

The main thing a CLI cannot replicate is the checksum database. Aside from that, all the secondary wins can be implemented by a CLI eventually like verifying the merkle tree and assigning installs to different registries, but that'd require a longer, actually a way longer, transition period. The CJS to ESM discussion has been there for years but still whether because of friction of migration or compatibility issues. So the more convenient the experience is, the better and the shorter this transition would be, specially if the transition takes one command only. 

`sum.npmx.dev` would be the source of truth, other than that, everything can replicated by CLIs in the long run with less convenience for the users potentially.  

### Why a sumdb instead of relying only on lockfile `integrity`?

The user still relies on the lockfile `integrity`, but value would come from the checksum database rather than each registry issuing its own integrity.  

### Why keep lockfiles pointing at the upstream tarball URL instead of the proxy URL?

Decentralization. So downloads would go directly to the responsible registry, otherwise, if all downloads would still go through the proxy, then that'd be the new point of centralization.

### What exactly does `keyId` mean here?

Hash of the registry's public key. Like [npm's keyId](https://registry.npmjs.org/-/npm/v1/keys).

### What does a successful verification prove?

That the registry serving the tarball is serving something others also agree to serve. It proves that the content is being served authentically (it's indeed coming from the desired place cryptographically) and consistently (what's being served now would be served later and what's being served for me, would be served to others too). 

### What does “decentralization” mean in this proposal?

Multiple registries and mirrors serving the _right_ content rather than only npm doing that. 

### Are mirrors and registries different in principle, or just in operational practice?

I don't understand the question honestly. 

### Are package names still the global npm names?

For the proxy, yes, initially, but the checksum database does not care about names as discussed below.

### If two sources claim the same package and version but offer different tarballs, what happens?

hard failure.

### Does this stop malicious maintainers?

No, registries that we redirect to would take that responsibility. 

### Does this stop `preinstall` and `postinstall` malware?

No, registries that we redirect to would take that responsibility. 

### Does this stop unpublishing or version replacement?

Yes.

### What does this system say about content authenticity versus content safety?

content authenticity is directly addressed but content safety is not and hopefully it'd be a secondary effect. 

### Who runs the sumdb?

npmx. 

### Which npm client flows already work with this prototype?

Tried it on npm and it was working. 

### Why is this better than a plain mirror?

plain mirrors already exists `registry.npmmirror.co` by [cnpm](https://github.com/cnpm/cnpmcore), but they're costly and they assume npm is the source of truth.

### Is the long-term goal to decentralize hosting, trust, naming, or all three?

hosting already is with this. trust, no, since every registry has to agree on a authenticity which there's only one of it. naming can be decentralized too because the checksum database does not care about names (even though it stores it) and rather it cares about the mix hash of values like the `integrity`, `digest`, `name`, `version`, `keyId` and bunch of other values. So it's possible that two different registries (two different `keyId`s) can host packages that share the same exact name but as long as the overall hash is not the same, they'd point to two different things. This would need a discussion around content-addressing (adressing tarballs based on content rather than name), but I'm sure that'd be easily possible like `npm add react#${hash of the content}`.     

### What would have to change next to support real multi-registry fetch selection?

The npmx proxy would be the fastest way to achieve this ideal, I think it's a matter of a PR or a few.

### What is the minimal next milestone that would prove this idea is viable?

I think there should be a wider discussion with the npmx team and teams like vlt, pnpm and other teams in the javascript (mainly npm) registries space. 

### “This is still centralized.” What is my answer?

No and Yes. Yes because we have a checksum database that everyone agrees on (though anyone can host their own checksum databases and proxies), and no because tarballs are not located into a centralized place anymore.  

### “This doesn’t solve install-time code execution.” What is my answer?

This is not the job of a checksum database or a proxy, rather, it's the job of mirrors or registries like the socket one I mentioned above. 

### “Why not just use npm mirrors?” What is my answer?

npm mirrors assume npm itself is the single source of truth. Here `sum.npmx.dev` is the source of truth for the content authenticity and registry can contribute to it. 

### “Why should anyone trust `sum.npmx.dev`?” What is my answer?

It's a dumb ledger that accepts changes as long as the cryptography makes sense.

### “If the proxy isn’t in the lockfile, what value is it adding?” What is my answer?

The biggest and most imporant part of this process is the initial `npm add` one, which is where the proxy plays an important role. After that and once the install request gets redirected to a registry, then the lockfile already has the correct `integrity` which comes from the checksum database and also the tarball url, which points to the registry. 
