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
                        { label: 'Lifecycle', slug: 'docs/sandboxes/lifecycle' },
                        { label: 'Running Commands', slug: 'docs/sandboxes/exec' },
                        { label: 'Interactive Shell', slug: 'docs/sandboxes/shell' },
                        { label: 'Web Shell', slug: 'docs/sandboxes/web-shell' },
                        { label: 'Files', slug: 'docs/sandboxes/files' },
                        { label: 'Networking', slug: 'docs/sandboxes/networking' },
                        { label: 'Preview URLs', slug: 'docs/sandboxes/preview-urls' },
                        { label: 'Thermal Management', slug: 'docs/sandboxes/thermal' },
                    ],
                },
                {
                    label: 'Managing',
                    items: [
                        { label: 'Users & Auth', slug: 'docs/managing/users' },
                        { label: 'Secrets', slug: 'docs/managing/secrets' },
                        { label: 'Volumes', slug: 'docs/managing/volumes' },
                        { label: 'Templates', slug: 'docs/managing/templates' },
                        { label: 'Images', slug: 'docs/managing/images' },
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
                        { label: 'Wire Protocol', slug: 'docs/reference/wire-protocol' },
                        { label: 'Configuration', slug: 'docs/reference/config' },
                    ],
                },
                {
                    label: 'Architecture',
                    items: [
                        { label: 'Overview', slug: 'docs/architecture/overview' },
                        { label: 'Guest Agent (Lohar)', slug: 'docs/architecture/guest-agent' },
                        { label: 'Firecracker Engine', slug: 'docs/architecture/engine' },
                        { label: 'Design Decisions', slug: 'docs/architecture/decisions' },
                    ],
                },
                {
                    label: 'Contributing',
                    collapsed: true,
                    items: [
                        { label: 'Testing', slug: 'docs/contributing/testing' },
                        { label: 'Kernel', slug: 'docs/contributing/kernel' },
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
