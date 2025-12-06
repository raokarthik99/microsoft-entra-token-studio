# Quickstart: Pinned Tokens in Navigation

## Overview

Pinned tokens let you promote up to five of your most-used token targets into a compact navigation surface for instant reissue. Pinned entries are always tied to favorites: pinning a token implicitly favorites it first, and unpinning removes it from the pinned area while keeping the favorite intact.

## Prerequisites

- The app is running locally (development or preview build).
- At least one app registration is configured and healthy.
- You can already issue tokens and create favorites from token results or history.

## Pinning Tokens

1. Issue a token as you normally would (App token or User token).
2. From one of these surfaces, choose **Pin**:
   - The main token result area.
   - The mini-dock view.
   - The fullscreen token inspector.
   - The history/recent activity item actions menu.
3. If the token is not yet a favorite, it is first added to favorites and then pinned.
4. The pinned entry appears in the navigation area, showing a compact label and token context.

> You can pin up to **five** distinct favorites (unique client-and-resource combinations). If you try to pin more, the app will explain that the limit has been reached and prompt you to unpin or replace an existing entry.

## Using Pinned Tokens

1. Look for the pinned tokens area in or near the main header/navigation.
2. Click a pinned entry to reissue a token using the same parameters as its favorite.
3. View the new token result in the main panel just as if it were reissued from history or favorites.

Pinned entries are ordered so that the most recently pinned items appear first, helping you keep “today’s” targets at the top.

## Managing Pinned vs Favorites

- **Unpin**: Use the **Unpin** action on a pinned entry to remove it from the navigation while leaving the favorite intact.
- **Delete/Unfavorite**: If you remove a favorite that is pinned, the pinned entry automatically disappears so that the pinned area never shows orphaned items.
- **Favorites List Ordering**: In the favorites view, pinned favorites appear first (ordered by most recently pinned), followed by non-pinned favorites ordered by when they were added.

## Troubleshooting

- **No pinned area visible**: Create at least one favorite and pin it from the token result, mini-dock, fullscreen view, or history.
- **Cannot pin more entries**: You may already have five pinned tokens. Unpin or remove one, then try again.
- **Pinned entry reissue fails**: Treat it like any other token issuance failure—verify the underlying favorite configuration and app credentials.
