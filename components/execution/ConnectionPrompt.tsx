"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Link2,
  CheckCircle2,
  Loader2,
  ExternalLink,
  X,
} from "lucide-react";

/* ── Types ── */

interface ServiceConnection {
  id: string;
  name: string;
  provider: string;
  icon: string; // SVG path or lucide icon
  color: string;
  connected: boolean;
  description: string;
}

const SERVICES: ServiceConnection[] = [
  {
    id: "linkedin",
    name: "LinkedIn",
    provider: "linkedin",
    icon: "linkedin",
    color: "#0A66C2",
    connected: false,
    description: "Post updates, share articles, manage your professional presence",
  },
  {
    id: "twitter",
    name: "X (Twitter)",
    provider: "twitter",
    icon: "twitter",
    color: "#000000",
    connected: false,
    description: "Post tweets, engage with followers, share updates",
  },
  {
    id: "github",
    name: "GitHub",
    provider: "github",
    icon: "github",
    color: "#333333",
    connected: false,
    description: "Create issues, PRs, manage repos, code review",
  },
  {
    id: "gmail",
    name: "Gmail",
    provider: "gmail",
    icon: "gmail",
    color: "#EA4335",
    connected: false,
    description: "Send and manage emails on your behalf",
  },
  {
    id: "slack",
    name: "Slack",
    provider: "slack",
    icon: "slack",
    color: "#4A154B",
    connected: false,
    description: "Send messages, manage channels, notifications",
  },
  {
    id: "notion",
    name: "Notion",
    provider: "notion",
    icon: "notion",
    color: "#000000",
    connected: false,
    description: "Search and manage your Notion workspace",
  },
  {
    id: "jira",
    name: "Jira",
    provider: "jira",
    icon: "jira",
    color: "#0052CC",
    connected: false,
    description: "Create tickets, manage sprints, track issues",
  },
  {
    id: "google_sheets",
    name: "Google Sheets",
    provider: "google_sheets",
    icon: "sheets",
    color: "#0F9D58",
    connected: false,
    description: "Read and write spreadsheet data",
  },
  {
    id: "google_calendar",
    name: "Google Calendar",
    provider: "google_calendar",
    icon: "calendar",
    color: "#4285F4",
    connected: false,
    description: "View and manage calendar events",
  },
  {
    id: "hubspot",
    name: "HubSpot",
    provider: "hubspot",
    icon: "hubspot",
    color: "#FF7A59",
    connected: false,
    description: "Manage contacts, deals, and CRM data",
  },
  {
    id: "instagram",
    name: "Instagram",
    provider: "instagram",
    icon: "instagram",
    color: "#E4405F",
    connected: false,
    description: "Post photos, stories, and engage with followers",
  },
  {
    id: "facebook",
    name: "Facebook",
    provider: "facebook",
    icon: "facebook",
    color: "#1877F2",
    connected: false,
    description: "Post to Pages, manage ads, engage audience",
  },
  {
    id: "youtube",
    name: "YouTube",
    provider: "youtube",
    icon: "youtube",
    color: "#FF0000",
    connected: false,
    description: "Manage channel, videos, and analytics",
  },
  {
    id: "stripe",
    name: "Stripe",
    provider: "stripe",
    icon: "stripe",
    color: "#635BFF",
    connected: false,
    description: "View payments, invoices, and financial data",
  },
  {
    id: "google_analytics",
    name: "Google Analytics",
    provider: "google_analytics",
    icon: "analytics",
    color: "#E37400",
    connected: false,
    description: "Website traffic and user behavior data",
  },
  {
    id: "linear",
    name: "Linear",
    provider: "linear",
    icon: "linear",
    color: "#5E6AD2",
    connected: false,
    description: "Track issues, projects, and sprints",
  },
  {
    id: "asana",
    name: "Asana",
    provider: "asana",
    icon: "asana",
    color: "#F06A6A",
    connected: false,
    description: "Manage tasks, projects, and team work",
  },
  {
    id: "airtable",
    name: "Airtable",
    provider: "airtable",
    icon: "airtable",
    color: "#18BFFF",
    connected: false,
    description: "Manage databases and structured data",
  },
  {
    id: "microsoft_teams",
    name: "Microsoft Teams",
    provider: "microsoft_teams",
    icon: "teams",
    color: "#6264A7",
    connected: false,
    description: "Send messages and collaborate with your team",
  },
  // ── Financial / Cash Flow ──
  {
    id: "paypal",
    name: "PayPal",
    provider: "paypal",
    icon: "paypal",
    color: "#003087",
    connected: false,
    description: "View transactions, balances, invoices, and settlements",
  },
  {
    id: "square",
    name: "Square",
    provider: "square",
    icon: "square",
    color: "#006AFF",
    connected: false,
    description: "POS transactions, deposits, inventory, and customers",
  },
  {
    id: "xero",
    name: "Xero",
    provider: "xero",
    icon: "xero",
    color: "#13B5EA",
    connected: false,
    description: "Invoices, bills, bank reconciliation, and financial reports",
  },
  {
    id: "freshbooks",
    name: "FreshBooks",
    provider: "freshbooks",
    icon: "freshbooks",
    color: "#0075DD",
    connected: false,
    description: "Client invoices, expenses, time tracking, and reports",
  },
  {
    id: "plaid",
    name: "Bank Accounts (Plaid)",
    provider: "plaid",
    icon: "plaid",
    color: "#111111",
    connected: false,
    description: "Connect any bank for real-time balances and transactions",
  },
  {
    id: "mercury",
    name: "Mercury",
    provider: "mercury",
    icon: "mercury",
    color: "#5C5CE0",
    connected: false,
    description: "Startup banking: balances, transactions, burn rate",
  },
  {
    id: "wave",
    name: "Wave",
    provider: "wave",
    icon: "wave",
    color: "#1C6EF2",
    connected: false,
    description: "Free accounting: invoices, expenses, and financial reports",
  },
  {
    id: "brex",
    name: "Brex",
    provider: "brex",
    icon: "brex",
    color: "#F26922",
    connected: false,
    description: "Corporate card transactions, budgets, and spend analytics",
  },
  {
    id: "gusto",
    name: "Gusto",
    provider: "gusto",
    icon: "gusto",
    color: "#F45D48",
    connected: false,
    description: "Payroll, employee costs, benefits, and tax data",
  },
];

/* ── Service Icon Component ── */

function ServiceIcon({ service, size = 24 }: { service: ServiceConnection; size?: number }) {
  const iconMap: Record<string, React.ReactNode> = {
    linkedin: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
        <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
      </svg>
    ),
    twitter: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
      </svg>
    ),
    github: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z" />
      </svg>
    ),
    gmail: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
        <path d="M24 5.457v13.909c0 .904-.732 1.636-1.636 1.636h-3.819V11.73L12 16.64l-6.545-4.91v9.273H1.636A1.636 1.636 0 010 19.366V5.457c0-2.023 2.309-3.178 3.927-1.964L5.455 4.64 12 9.548l6.545-4.91 1.528-1.145C21.69 2.28 24 3.434 24 5.457z" />
      </svg>
    ),
    slack: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
        <path d="M5.042 15.165a2.528 2.528 0 01-2.52 2.523A2.528 2.528 0 010 15.165a2.527 2.527 0 012.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 012.521-2.52 2.527 2.527 0 012.521 2.52v6.313A2.528 2.528 0 018.834 24a2.528 2.528 0 01-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 01-2.521-2.52A2.528 2.528 0 018.834 0a2.528 2.528 0 012.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 012.521 2.521 2.528 2.528 0 01-2.521 2.521H2.522A2.528 2.528 0 010 8.834a2.528 2.528 0 012.522-2.521h6.312zM18.956 8.834a2.528 2.528 0 012.522-2.521A2.528 2.528 0 0124 8.834a2.528 2.528 0 01-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 01-2.523 2.521 2.527 2.527 0 01-2.52-2.521V2.522A2.527 2.527 0 0115.165 0a2.528 2.528 0 012.523 2.522v6.312zM15.165 18.956a2.528 2.528 0 012.523 2.522A2.528 2.528 0 0115.165 24a2.527 2.527 0 01-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 01-2.52-2.523 2.526 2.526 0 012.52-2.52h6.313A2.527 2.527 0 0124 15.165a2.528 2.528 0 01-2.522 2.523h-6.313z" />
      </svg>
    ),
    notion: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
        <path d="M4.459 4.208c.746.606 1.026.56 2.428.466l13.215-.793c.28 0 .047-.28-.046-.326L18.28 2.25c-.42-.326-.98-.7-2.055-.607L3.34 2.87c-.466.046-.56.28-.374.466zm.793 3.08v13.904c0 .747.373 1.027 1.214.98l14.523-.84c.84-.046.933-.56.933-1.167V6.354c0-.606-.233-.933-.746-.886l-15.177.886c-.56.047-.747.327-.747.934zm14.337.745c.093.42 0 .84-.42.888l-.7.14v10.264c-.607.327-1.167.514-1.634.514-.746 0-.933-.234-1.493-.933l-4.574-7.186v6.953l1.447.327s0 .84-1.167.84l-3.22.187c-.093-.187 0-.653.327-.746l.84-.233V9.854L7.46 9.76c-.094-.42.14-1.026.793-1.073l3.454-.234 4.76 7.28V9.34l-1.214-.14c-.093-.514.28-.886.747-.933z" />
      </svg>
    ),
    jira: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
        <path d="M11.571 11.513H0a5.218 5.218 0 005.232 5.215h2.13v2.057A5.215 5.215 0 0012.575 24V12.518a1.005 1.005 0 00-1.005-1.005zm5.723-5.756H5.736a5.215 5.215 0 005.215 5.214h2.129v2.058a5.218 5.218 0 005.215 5.214V6.758a1.001 1.001 0 00-1.001-1.001zM23 .006H11.455a5.215 5.215 0 005.215 5.215h2.129v2.057A5.215 5.215 0 0024 12.483V1.005A.998.998 0 0023 .006z" />
      </svg>
    ),
    sheets: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
        <path d="M11.318 12.545H7.91v-1.909h3.41v1.909zM14.728 0v6h6l-6-6zM16.091 12.545h-3.41v1.909h3.41v-1.909zM7.91 14.455h3.41v1.909H7.91v-1.909zM16.091 14.455h-3.41v1.909h3.41v-1.909zM14.182 6.545V0H3.727v24h16.91V6.545h-6.455zM17.455 17.727H6.545v-8.727h10.909v8.727zM16.091 10.636h-3.41v1.909h3.41v-1.909zM7.91 10.636v1.909h3.41v-1.909H7.91z" />
      </svg>
    ),
    calendar: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
        <path d="M19 4h-1V2h-2v2H8V2H6v2H5c-1.11 0-1.99.9-1.99 2L3 20c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V10h14v10zm0-12H5V6h14v2zM9 14H7v-2h2v2zm4 0h-2v-2h2v2zm4 0h-2v-2h2v2zm-8 4H7v-2h2v2zm4 0h-2v-2h2v2zm4 0h-2v-2h2v2z" />
      </svg>
    ),
    hubspot: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
        <path d="M18.164 7.93V5.084a2.198 2.198 0 001.267-1.984v-.066A2.198 2.198 0 0017.235.838h-.066a2.198 2.198 0 00-2.196 2.196v.066c0 .907.55 1.684 1.335 2.02v2.81a6.27 6.27 0 00-2.792 1.266l-7.453-5.794a2.465 2.465 0 00.076-.6A2.476 2.476 0 003.663.326h-.001a2.476 2.476 0 000 4.953c.487 0 .939-.144 1.32-.39l7.333 5.7a6.293 6.293 0 00-.16 7.415l-2.2 2.2a2.053 2.053 0 00-.597-.098 2.078 2.078 0 102.078 2.078c0-.206-.04-.402-.097-.589l2.168-2.168a6.29 6.29 0 009.16-5.556 6.291 6.291 0 00-5.503-6.24z" />
      </svg>
    ),
    instagram: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
      </svg>
    ),
    facebook: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
      </svg>
    ),
    youtube: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
        <path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
      </svg>
    ),
    stripe: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
        <path d="M13.976 9.15c-2.172-.806-3.356-1.426-3.356-2.409 0-.831.683-1.305 1.901-1.305 2.227 0 4.515.858 6.09 1.631l.89-5.494C18.252.975 15.697 0 12.165 0 9.667 0 7.589.654 6.104 1.872 4.56 3.147 3.757 4.992 3.757 7.218c0 4.039 2.467 5.76 6.476 7.219 2.585.92 3.445 1.574 3.445 2.583 0 .98-.84 1.545-2.354 1.545-1.875 0-4.965-.921-6.99-2.109l-.9 5.555C5.175 22.99 8.385 24 11.714 24c2.641 0 4.843-.624 6.328-1.813 1.664-1.305 2.525-3.236 2.525-5.732 0-4.128-2.524-5.851-6.591-7.305z" />
      </svg>
    ),
    analytics: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
        <path d="M22.84 2.998v17.958c0 .97-.788 1.758-1.758 1.758h-2.344c-.97 0-1.758-.788-1.758-1.758V2.998c0-.97.788-1.758 1.758-1.758h2.344c.97 0 1.758.788 1.758 1.758zM14.4 8.918v12.038c0 .97-.788 1.758-1.758 1.758H10.3c-.97 0-1.758-.788-1.758-1.758V8.918c0-.97.788-1.758 1.758-1.758h2.344c.97 0 1.758.788 1.758 1.758zM5.96 14.838v6.118c0 .97-.788 1.758-1.758 1.758H1.858C.888 22.714.1 21.926.1 20.956v-6.118c0-.97.788-1.758 1.758-1.758h2.344c.97 0 1.758.788 1.758 1.758z" />
      </svg>
    ),
    linear: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
        <path d="M2.643 14.092a.618.618 0 01-.04-.218.625.625 0 01.169-.432l7.786-7.786a.626.626 0 01.432-.169c.076 0 .15.014.218.04l9.063 3.412a.625.625 0 01.345.82.626.626 0 01-.345.344l-3.413 1.141a.625.625 0 00-.344.344L15.373 14.9a.625.625 0 01-.82.345L2.643 14.092zM1.1 15.952a.625.625 0 00-.055.925l6.078 6.078a.625.625 0 00.925-.055l2.207-2.758a.625.625 0 00-.063-.844l-6.298-6.298a.625.625 0 00-.844-.063L1.1 15.952z" />
      </svg>
    ),
    asana: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
        <path d="M18.78 12.653c-2.882 0-5.22 2.337-5.22 5.219s2.338 5.22 5.22 5.22 5.22-2.338 5.22-5.22-2.337-5.22-5.22-5.22zM5.22 12.653C2.337 12.653 0 14.99 0 17.872s2.337 5.22 5.22 5.22 5.22-2.338 5.22-5.22-2.338-5.22-5.22-5.22zM17.22 5.22C17.22 2.337 14.882 0 12 0S6.78 2.337 6.78 5.22 9.118 10.44 12 10.44s5.22-2.338 5.22-5.22z" />
      </svg>
    ),
    airtable: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
        <path d="M11.532 2.537L2.343 6.247a.625.625 0 000 1.146l9.188 3.71a2.26 2.26 0 001.698 0l9.188-3.71a.625.625 0 000-1.146l-9.188-3.71a2.26 2.26 0 00-1.697 0zM2 9.5v7.75a.625.625 0 00.368.569l9 4.063a.625.625 0 00.882-.569V13.5L2 9.5zm20 0l-10.25 4v7.813a.625.625 0 00.882.569l9-4.063a.625.625 0 00.368-.569V9.5z" />
      </svg>
    ),
    teams: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
        <path d="M20.625 8.25h-1.5c.075-.39.125-.787.125-1.2a4.55 4.55 0 00-4.55-4.55 4.52 4.52 0 00-2.7.9 5.25 5.25 0 00-8.25 4.3v.025c0 .18.012.356.03.53H2.25a1.5 1.5 0 00-1.5 1.5V15a1.5 1.5 0 001.5 1.5h2.325c.45 2.1 2.325 3.75 4.575 3.75s4.125-1.65 4.575-3.75h.9c.563 1.013 1.638 1.725 2.888 1.725a3.263 3.263 0 003.262-3.262V9.75a1.5 1.5 0 00-1.5-1.5zM14.7 4.2a2.85 2.85 0 012.55 1.575 5.22 5.22 0 00-2.55 1.87V5a5.22 5.22 0 00-.525-.588A2.8 2.8 0 0114.7 4.2zM9.15 5a3.55 3.55 0 013.55 3.55V15a3.55 3.55 0 01-7.1 0V8.55A3.55 3.55 0 019.15 5z" />
      </svg>
    ),
    // ── Financial / Cash Flow Icons ──
    paypal: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
        <path d="M7.076 21.337H2.47a.641.641 0 01-.633-.74L4.944.901C5.026.382 5.474 0 5.998 0h7.46c2.57 0 4.578.543 5.69 1.81 1.01 1.15 1.304 2.42 1.012 4.287-.023.143-.047.288-.077.437-.983 5.05-4.349 6.797-8.647 6.797h-2.19c-.524 0-.968.382-1.05.9l-1.12 7.106zm14.146-14.42a3.35 3.35 0 00-.607-.541c-.013.076-.026.175-.041.254-.93 4.778-4.005 7.201-9.138 7.201h-2.19a.563.563 0 00-.556.479l-1.187 7.527h-.506l-.24 1.516a.56.56 0 00.554.647h3.882c.46 0 .85-.334.922-.788.06-.26.76-4.852.816-5.09a.932.932 0 01.921-.788h.58c3.76 0 6.705-1.528 7.565-5.946.36-1.847.174-3.388-.775-4.471z" />
      </svg>
    ),
    square: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
        <path d="M4.01 0A3.998 3.998 0 000 3.99v16.02C0 22.21 1.79 24 3.99 24h16.02c2.21 0 3.99-1.79 3.99-3.99V3.99C24 1.79 22.21 0 20.01 0H4.01zm1.49 4.5h13c.83 0 1.5.67 1.5 1.5v12c0 .83-.67 1.5-1.5 1.5h-13c-.83 0-1.5-.67-1.5-1.5V6c0-.83.67-1.5 1.5-1.5zm2 3v9h9v-9h-9z" />
      </svg>
    ),
    xero: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm-1.243 15.243L8.47 12.956l-2.287 2.287-.707-.707L7.763 12.25 5.476 9.964l.707-.707L8.47 11.543l2.287-2.286.707.707L9.177 12.25l2.287 2.286-.707.707zm4.486 0L12.956 12.956l-2.287 2.287-.707-.707 2.287-2.286-2.287-2.286.707-.707 2.287 2.286 2.287-2.286.707.707-2.287 2.286 2.287 2.286-.707.707z" />
      </svg>
    ),
    freshbooks: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
        <path d="M12.713.666L4 3.754v16.493l8.713 3.087L20 20.247V3.754L12.713.666zM17.5 18.5l-4.787 1.696L8 18.5V5.5l4.713-1.696L17.5 5.5v13z" />
      </svg>
    ),
    plaid: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
        <path d="M10.005 0L0 4.002v7.996L4.002 14V6.004L10.005 4V0zm3.99 0v4l6.003 2.004V14l4.002-2.002V4.002L13.995 0zM0 12.002L4.002 14v7.998L10.005 24v-4L4.002 18V12.002H0zm20 0V18l-6.005 2v4l10.005-4v-7.998h-4z" />
      </svg>
    ),
    mercury: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm0 18c-4.411 0-8-3.589-8-8s3.589-8 8-8 8 3.589 8 8-3.589 8-8 8zm-1-13h2v6h-2V7zm0 8h2v2h-2v-2z" />
      </svg>
    ),
    wave: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
        <path d="M2 12c1.5-3 3-6 5-6s3 6 5 6 3-6 5-6 3.5 3 5 6" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" />
      </svg>
    ),
    brex: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
        <path d="M3 4h18a2 2 0 012 2v12a2 2 0 01-2 2H3a2 2 0 01-2-2V6a2 2 0 012-2zm0 4v10h18V8H3zm2 2h4v2H5v-2zm6 0h4v2h-4v-2z" />
      </svg>
    ),
    gusto: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
      </svg>
    ),
  };

  return (
    <span style={{ color: service.color }}>
      {iconMap[service.icon] ?? <Link2 size={size} />}
    </span>
  );
}

/* ── Main Component ── */

export interface ConnectionPromptProps {
  orgId: string;
  /** If provided, only show these services */
  filterServices?: string[];
  /** Compact mode for inline chat display */
  compact?: boolean;
  onConnectionChange?: () => void;
}

export default function ConnectionPrompt({
  orgId,
  filterServices,
  compact = false,
  onConnectionChange,
}: ConnectionPromptProps) {
  const [services, setServices] = useState<ServiceConnection[]>(
    filterServices
      ? SERVICES.filter((s) => filterServices.includes(s.provider))
      : SERVICES
  );
  const [connecting, setConnecting] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(!compact);

  // Check which services are connected
  const fetchConnections = useCallback(async () => {
    try {
      const res = await fetch(`/api/integrations/list?orgId=${encodeURIComponent(orgId)}`);
      if (!res.ok) return;
      const data = await res.json();
      const connectedProviders = new Set(
        (data.integrations ?? [])
          .filter((i: { status: string }) => i.status === "connected")
          .map((i: { provider: string }) => i.provider)
      );

      setServices((prev) =>
        prev.map((s) => ({
          ...s,
          connected: connectedProviders.has(s.provider),
        }))
      );
    } catch {
      // Silent fail
    }
  }, [orgId]);

  useEffect(() => {
    fetchConnections();
  }, [fetchConnections]);

  // Listen for OAuth callback redirects
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("integration") === "connected") {
      fetchConnections();
      onConnectionChange?.();
    }
  }, [fetchConnections, onConnectionChange]);

  const handleConnect = async (provider: string) => {
    setConnecting(provider);
    try {
      const res = await fetch("/api/integrations/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, orgId }),
      });

      const data = await res.json();

      if (data.redirectUrl) {
        window.open(data.redirectUrl, "_blank", "width=600,height=700");
        // Poll for connection status — fetch fresh list each time to avoid stale closure
        const interval = setInterval(async () => {
          try {
            const pollRes = await fetch(`/api/integrations/list?orgId=${orgId}`);
            if (pollRes.ok) {
              const pollData = await pollRes.json();
              const integrations = pollData.integrations ?? [];
              const isConnected = integrations.some(
                (i: { provider: string; status: string }) => i.provider === provider && i.status === "connected"
              );
              if (isConnected) {
                clearInterval(interval);
                setConnecting(null);
                await fetchConnections();
                onConnectionChange?.();
              }
            }
          } catch { /* poll error, retry next interval */ }
        }, 3000);
        // Stop polling after 2 minutes
        const timeout = setTimeout(() => {
          clearInterval(interval);
          setConnecting(null);
        }, 120000);
        // Cleanup on unmount would need a ref — this is a one-shot action so timeout is acceptable
        void timeout;
      } else if (data.connected) {
        await fetchConnections();
        setConnecting(null);
        onConnectionChange?.();
      } else {
        console.error("Connection failed:", data.error);
        setConnecting(null);
      }
    } catch (err) {
      console.error("Connection error:", err);
      setConnecting(null);
    }
  };

  const connectedCount = services.filter((s) => s.connected).length;

  // Single-service inline mode — fits inside chat bubbles
  if (filterServices?.length === 1 && compact) {
    const service = services[0];
    if (!service) return null;
    if (service.connected) {
      return (
        <div className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg">
          <CheckCircle2 size={14} />
          <span>{service.name} connected</span>
        </div>
      );
    }
    return (
      <button
        onClick={() => handleConnect(service.provider)}
        disabled={connecting === service.provider}
        className="inline-flex items-center gap-2 px-3 py-2 text-xs font-medium text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-lg hover:bg-indigo-100 hover:border-indigo-300 transition-all active:scale-95"
      >
        {connecting === service.provider ? (
          <Loader2 size={14} className="animate-spin" />
        ) : (
          <ServiceIcon service={service} size={16} />
        )}
        <span>
          {connecting === service.provider
            ? "Connecting..."
            : `Connect ${service.name}`}
        </span>
        {connecting !== service.provider && <ExternalLink size={10} />}
      </button>
    );
  }

  if (compact && !expanded) {
    return (
      <button
        onClick={() => setExpanded(true)}
        className="flex items-center gap-2 px-3 py-2 text-xs font-medium text-zinc-400 hover:text-white bg-zinc-900/50 border border-zinc-800 rounded-lg transition-colors"
      >
        <Link2 size={14} />
        <span>
          {connectedCount}/{services.length} connected
        </span>
      </button>
    );
  }

  return (
    <div className="bg-zinc-950 border border-zinc-800 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
        <div className="flex items-center gap-2">
          <Link2 size={16} className="text-blue-400" />
          <h3 className="text-sm font-semibold text-white">
            Connect Services
          </h3>
          <span className="text-xs text-zinc-500">
            {connectedCount}/{services.length}
          </span>
        </div>
        {compact && (
          <button
            onClick={() => setExpanded(false)}
            className="text-zinc-500 hover:text-white"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* Service Grid */}
      <div className="p-3 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
        {services.map((service) => (
          <button
            key={service.id}
            onClick={() => !service.connected && handleConnect(service.provider)}
            disabled={service.connected || connecting === service.provider}
            className={`
              group relative flex flex-col items-center gap-2 p-3 rounded-lg border transition-all
              ${
                service.connected
                  ? "border-emerald-500/30 bg-emerald-500/5 cursor-default"
                  : connecting === service.provider
                  ? "border-blue-500/30 bg-blue-500/5 cursor-wait"
                  : "border-zinc-800 bg-zinc-900/50 hover:border-zinc-600 hover:bg-zinc-900 cursor-pointer"
              }
            `}
            title={service.description}
          >
            {/* Status indicator */}
            {service.connected && (
              <div className="absolute top-1.5 right-1.5">
                <CheckCircle2 size={12} className="text-emerald-400" />
              </div>
            )}

            {/* Icon */}
            <div className="relative">
              {connecting === service.provider ? (
                <Loader2
                  size={24}
                  className="animate-spin text-blue-400"
                />
              ) : (
                <ServiceIcon service={service} size={24} />
              )}
            </div>

            {/* Name */}
            <span
              className={`text-xs font-medium ${
                service.connected
                  ? "text-emerald-400"
                  : "text-zinc-400 group-hover:text-white"
              }`}
            >
              {service.name}
            </span>

            {/* Connect hint */}
            {!service.connected && connecting !== service.provider && (
              <span className="absolute inset-0 flex items-center justify-center bg-black/60 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity">
                <span className="flex items-center gap-1 text-xs text-white font-medium">
                  Connect <ExternalLink size={10} />
                </span>
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Helper text */}
      <div className="px-4 pb-3">
        <p className="text-xs text-zinc-600">
          Connect services so your agents can take real actions — post to
          social media, send emails, create issues, and more.
        </p>
      </div>
    </div>
  );
}
