// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import mdx from '@astrojs/mdx';
import starlightLlmsTxt from 'starlight-llms-txt';

// https://astro.build/config
export default defineConfig({
    site: 'https://bhatti.sh',
    // Old how-to pages were folded into the per-command reference. Anyone
    // landing on the old URLs goes to the closest reference target.
    redirects: {
        '/docs/sandboxes/lifecycle/':    '/docs/reference/cli/sandbox/',
        '/docs/sandboxes/exec/':         '/docs/reference/cli/exec/exec/',
        '/docs/sandboxes/shell/':        '/docs/reference/cli/exec/shell/',
        '/docs/sandboxes/web-shell/':    '/docs/reference/cli/networking/share/',
        '/docs/sandboxes/files/':        '/docs/reference/cli/files/',
        '/docs/sandboxes/preview-urls/': '/docs/reference/cli/networking/publish/',
        '/docs/managing/templates/':     '/docs/reference/api/#templates',
    },
    integrations: [
        starlight({
            title: '[bhatti]',
            social: [
                { icon: 'github', label: 'GitHub', href: 'https://github.com/sahil-shubham/bhatti' },
                { icon: 'external', label: 'bhatti.sh', href: 'https://bhatti.sh' },
            ],
            customCss: [
                './src/styles/bhatti-docs.css',
            ],
            // Force dark mode — matches marketing site
            components: {
                ThemeSelect: './src/components/ThemeSelectOverride.astro',
            },
            plugins: [
                starlightLlmsTxt({
                    projectName: 'bhatti',
                    description:
                        'Open-source Firecracker microVM orchestrator. Real Linux VMs created in seconds, snapshotted to disk, resumed in microseconds. Built for running AI coding agents in isolated environments.',
                    details: [
                        'bhatti is a single binary. `bhatti serve` runs the daemon; everything else is a CLI client that talks to its HTTP API.',
                        'lohar is the guest agent that runs as PID 1 inside every microVM. It handles command execution, file operations, PTY sessions, and communicates with the host over a vsock connection.',
                        '',
                        'When using bhatti, prefer the CLI Reference (per-command) and the API Reference. The Under the Hood section is for understanding the engineering, not for everyday use.',
                    ].join('\n'),
                    // Float the docs entry-points to the top of every section
                    // listing so an agent reading sequentially gets oriented first.
                    promote: [
                        'index*',
                        'docs/quickstart*',
                        'docs/concepts*',
                        'docs/reference/cli/index*',
                        'docs/reference/api*',
                        'docs/reference/config*',
                    ],
                    // Push Under-the-Hood content to the end — valuable but not
                    // required to use bhatti. The plugin itself handles the
                    // `## Optional` section grouping; this just controls order
                    // within the generated index.
                    demote: ['docs/under-the-hood/**'],
                    // Curated link list for `## Optional`. The plugin still
                    // catalogues these pages in the main sections, but agents
                    // on a tight context budget can skip everything here.
                    optionalLinks: [
                        {
                            label: 'OpenAPI YAML',
                            url: 'https://github.com/sahil-shubham/bhatti/blob/main/docs/openapi.yaml',
                            description:
                                'Machine-readable API spec. The hand-curated /docs/reference/api/ page is the human-friendly version; this is the source of truth for tooling.',
                        },
                    ],
                    // Topic-scoped subsets. Each gets its own URL at
                    // /_llms-txt/<slug>.txt and a link from /llms.txt.
                    // Useful for agents that don't need the whole corpus.
                    customSets: [
                        {
                            label: 'CLI Reference',
                            description:
                                'Every bhatti CLI command with synopsis, options, examples, and exit codes. Best starting point for agents driving bhatti from a shell.',
                            paths: [
                                'docs/reference/cli',
                                'docs/reference/cli/**',
                            ],
                        },
                        {
                            label: 'API Reference',
                            description:
                                'HTTP API reference with curl examples and response shapes for every endpoint. Use this when calling the bhatti server programmatically.',
                            paths: [
                                'docs/reference/api',
                            ],
                        },
                        {
                            label: 'Getting Started',
                            description:
                                'Install, configure, and create the first sandbox. Concepts page covers the mental model.',
                            paths: [
                                'docs/quickstart',
                                'docs/concepts',
                                'docs/self-hosting',
                                'docs/updating',
                            ],
                        },
                    ],
                }),
            ],
            sidebar: [
                {
                    label: 'Getting Started',
                    items: [
                        { label: 'Quickstart', slug: 'docs/quickstart' },
                        { label: 'Self-Hosting', slug: 'docs/self-hosting' },
                        { label: 'Concepts', slug: 'docs/concepts' },
                    ],
                },
                {
                    label: 'Managing',
                    items: [
                        { label: 'Users & Auth', slug: 'docs/managing/users' },
                        { label: 'Secrets', slug: 'docs/managing/secrets' },
                        { label: 'Volumes', slug: 'docs/managing/volumes' },
                        { label: 'Images & Tiers', slug: 'docs/managing/images' },
                        { label: 'Custom Domain', slug: 'docs/managing/custom-domain' },
                    ],
                },
                {
                    label: 'Updating & Uninstalling',
                    slug: 'docs/updating',
                },
                {
                    label: 'Under the Hood',
                    items: [
                        { label: 'Architecture overview', slug: 'docs/under-the-hood/architecture' },
                        { label: 'Firecracker engine internals', slug: 'docs/under-the-hood/engine' },
                        { label: 'Lohar: the agent inside every VM', slug: 'docs/under-the-hood/lohar-the-blacksmith' },
                        { label: 'Thermal states', slug: 'docs/under-the-hood/thermal-states' },
                        { label: 'Networking', slug: 'docs/under-the-hood/networking' },
                        { label: 'The wire protocol', slug: 'docs/under-the-hood/wire-protocol' },
                        { label: 'Decisions & learnings', slug: 'docs/under-the-hood/decisions' },
                    ],
                },
                {
                    label: 'Reference',
                    items: [
                        { label: 'API Reference', slug: 'docs/reference/api' },
                        { label: 'CLI Overview', slug: 'docs/reference/cli' },
                        // Each group switches from a flat slug-link to
                        // `autogenerate` only once its per-command pages exist.
                        // This avoids "collapsible group with one item" until
                        // a group actually has multiple commands documented.
                        // Each command group is collapsed by default. Starlight
                        // always force-opens the group containing the current
                        // page, and sessionStorage remembers user clicks within
                        // a tab — so this only affects "first time landing on
                        // a non-reference page in a fresh tab".
                        {
                            label: 'Sandbox',
                            collapsed: true,
                            autogenerate: { directory: 'docs/reference/cli/sandbox', collapsed: true },
                        },
                        {
                            label: 'Execution & shells',
                            collapsed: true,
                            autogenerate: { directory: 'docs/reference/cli/exec', collapsed: true },
                        },
                        {
                            label: 'Files',
                            collapsed: true,
                            autogenerate: { directory: 'docs/reference/cli/files', collapsed: true },
                        },
                        {
                            label: 'Networking & sharing',
                            collapsed: true,
                            autogenerate: { directory: 'docs/reference/cli/networking', collapsed: true },
                        },
                        {
                            label: 'Images',
                            collapsed: true,
                            autogenerate: { directory: 'docs/reference/cli/images', collapsed: true },
                        },
                        {
                            label: 'Volumes',
                            collapsed: true,
                            autogenerate: { directory: 'docs/reference/cli/volumes', collapsed: true },
                        },
                        {
                            label: 'Secrets',
                            collapsed: true,
                            autogenerate: { directory: 'docs/reference/cli/secrets', collapsed: true },
                        },
                        {
                            label: 'Snapshots',
                            collapsed: true,
                            autogenerate: { directory: 'docs/reference/cli/snapshots', collapsed: true },
                        },
                        {
                            label: 'Server & admin',
                            collapsed: true,
                            autogenerate: { directory: 'docs/reference/cli/admin', collapsed: true },
                        },
                        { label: 'Configuration', slug: 'docs/reference/config' },
                    ],
                },
                {
                    label: 'Contributing',
                    collapsed: true,
                    items: [
                        { label: 'Testing', slug: 'docs/contributing/testing' },
                        { label: 'Building the Kernel', slug: 'docs/contributing/kernel' },
                        { label: 'Adding a Tier', slug: 'docs/contributing/adding-a-tier' },
                    ],
                },
            ],
            editLink: {
                baseUrl: 'https://github.com/sahil-shubham/bhatti/edit/main/bhatti.sh/',
            },
            head: [
                {
                    tag: 'meta',
                    attrs: {
                        name: 'color-scheme',
                        content: 'dark',
                    },
                },
                {
                    tag: 'link',
                    attrs: {
                        rel: 'preconnect',
                        href: 'https://fonts.googleapis.com',
                    },
                },
                {
                    tag: 'link',
                    attrs: {
                        rel: 'preconnect',
                        href: 'https://fonts.gstatic.com',
                        crossorigin: true,
                    },
                },
                {
                    tag: 'link',
                    attrs: {
                        rel: 'stylesheet',
                        href: 'https://fonts.googleapis.com/css2?family=Geist+Mono:wght@100..900&family=Geist:wght@100..900&display=swap',
                    },
                },
                // Click-to-copy on heading anchor links. Replaces the default
                // jump-to-anchor behaviour with a clipboard copy of the full URL,
                // matching the Scalar/Stripe docs convention. The icon is always
                // visible (CSS handles that). On click: copy + brief tooltip.
                {
                    tag: 'script',
                    content: `
document.addEventListener('click', function(e) {
  var link = e.target.closest('.sl-anchor-link');
  if (!link) return;
  e.preventDefault();
  var hash = link.getAttribute('href') || '';
  var fullUrl = window.location.origin + window.location.pathname + hash;

  // Update URL bar without scroll.
  history.replaceState(null, '', hash);

  // Copy.
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(fullUrl).then(showCopied).catch(showCopied);
  } else {
    showCopied();
  }

  function showCopied() {
    link.classList.add('sl-anchor-copied');
    var tip = document.createElement('span');
    tip.className = 'sl-anchor-copied-tooltip';
    tip.textContent = 'link copied';
    link.appendChild(tip);
    setTimeout(function() {
      tip.remove();
      link.classList.remove('sl-anchor-copied');
    }, 1400);
  }
});
`.trim(),
                },
            ],
            expressiveCode: {
                themes: ['github-dark'],
            },
        }),
        // mdx() must come *after* starlight so astro-expressive-code (registered
         // by starlight) initialises first.
        mdx(),
    ],
});
