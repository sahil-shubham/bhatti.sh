// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

// https://astro.build/config
export default defineConfig({
    site: 'https://bhatti.sh',
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
                    label: 'Sandboxes',
                    items: [
                        { label: 'Create & Destroy', slug: 'docs/sandboxes/lifecycle' },
                        { label: 'Run Commands', slug: 'docs/sandboxes/exec' },
                        { label: 'Interactive Shell', slug: 'docs/sandboxes/shell' },
                        { label: 'Web Shell', slug: 'docs/sandboxes/web-shell' },
                        { label: 'Files', slug: 'docs/sandboxes/files' },
                        { label: 'Preview URLs', slug: 'docs/sandboxes/preview-urls' },
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
                        { label: 'Templates', slug: 'docs/managing/templates' },
                    ],
                },
                {
                    label: 'Updating & Uninstalling',
                    slug: 'docs/updating',
                },
                {
                    label: 'Under the Hood',
                    items: [
                        { label: 'Architecture Overview', slug: 'docs/under-the-hood/architecture' },
                        { label: 'Lohar: PID 1 Inside Every VM', slug: 'docs/under-the-hood/lohar' },
                        { label: 'Thermal States & Snapshots', slug: 'docs/under-the-hood/thermal' },
                        { label: 'Networking: Bridges, TAP & ip=', slug: 'docs/under-the-hood/networking' },
                        { label: 'The Wire Protocol', slug: 'docs/under-the-hood/wire-protocol' },
                        { label: 'Firecracker Engine', slug: 'docs/under-the-hood/engine' },
                        { label: 'Design Decisions', slug: 'docs/under-the-hood/decisions' },
                    ],
                },
                {
                    label: 'Reference',
                    items: [
                        { label: 'API Reference', slug: 'docs/reference/api' },
                        {
                            label: 'CLI Reference',
                            items: [
                                { label: 'Overview', slug: 'docs/reference/cli' },
                                { label: 'Sandbox Commands', slug: 'docs/reference/cli/sandbox' },
                                { label: 'Execution & Shells', slug: 'docs/reference/cli/exec' },
                                { label: 'File Operations', slug: 'docs/reference/cli/files' },
                                { label: 'Networking & Sharing', slug: 'docs/reference/cli/publish' },
                                { label: 'Resources', slug: 'docs/reference/cli/resources' },
                                { label: 'Server & Admin', slug: 'docs/reference/cli/admin' },
                            ],
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
            ],
            expressiveCode: {
                themes: ['github-dark'],
            },
        }),
    ],
});
