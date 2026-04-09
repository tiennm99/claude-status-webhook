/**
 * Shared JSDoc type definitions for the project.
 * Import via: @import { Subscriber, QueueMessage, ChatTarget } from "./types.js"
 */

/**
 * Subscriber preferences stored in KV value and metadata
 * @typedef {{ types: string[], components: string[] }} Subscriber
 */

/**
 * Message body enqueued to CF Queue for fan-out delivery
 * @typedef {{ chatId: number, threadId: ?number, html: string }} QueueMessage
 */

/**
 * Chat target extracted from Telegram update
 * @typedef {{ chatId: number, threadId: ?number }} ChatTarget
 */

export {};
