import type { StorybookEntry, StorybookFileTree } from '#shared/types'

/**
 * Transform flat Storybook entries into hierarchical tree structure
 */
export function transformStorybookEntries(
  entries: Record<string, StorybookEntry>,
): StorybookFileTree[] {
  const tree: StorybookFileTree[] = []
  const dirMap = new Map<string, StorybookFileTree>()

  // Sort entries by title for consistent ordering
  const sortedEntries = Object.values(entries).sort((a, b) =>
    (a.title || '').localeCompare(b.title || ''),
  )

  for (const entry of sortedEntries) {
    // Parse title into path parts
    // "Example/Button/Primary" -> ["Example", "Button", "Primary"]
    if (!entry.title) continue
    const parts = entry.title.split('/')
    const storyName = parts.pop()! // Last part is the story name
    const storyPath = parts.join('/') || '' || ''

    // Create directories as needed
    let currentPath = ''
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i]
      if (!part) continue
      currentPath = currentPath ? `${currentPath}/${part}` : part

      if (!dirMap.has(currentPath)) {
        const dirNode: StorybookFileTree = {
          name: part,
          path: currentPath,
          type: 'directory',
          children: [],
        }
        dirMap.set(currentPath, dirNode)

        // Add to appropriate parent
        if (i === 0) {
          tree.push(dirNode)
        } else {
          const parentPath = parts.slice(0, i).join('/') || ''
          const parent = dirMap.get(parentPath)
          if (parent) {
            parent.children!.push(dirNode)
          }
        }
      }
    }

    // Create story node
    const storyNode: StorybookFileTree = {
      name: storyName,
      path: entry.title,
      type: 'story',
      storyId: entry.id,
      story: entry,
    }

    // Add story to its directory or root
    if (storyPath) {
      const parentDir = dirMap.get(storyPath)
      if (parentDir) {
        parentDir.children!.push(storyNode)
      }
    } else {
      // Root level story
      tree.push(storyNode)
    }
  }

  return tree
}

/**
 * Find a story by its ID in the tree
 */
export function findStoryById(
  tree: StorybookFileTree[],
  storyId: string,
): StorybookFileTree | null {
  for (const node of tree) {
    if (node.type === 'story' && node.storyId === storyId) {
      return node
    }
    if (node.type === 'directory' && node.children) {
      const found = findStoryById(node.children, storyId)
      if (found) return found
    }
  }
  return null
}

/**
 * Get the first story from the tree (for default selection)
 */
export function getFirstStory(tree: StorybookFileTree[]): StorybookFileTree | null {
  for (const node of tree) {
    if (node.type === 'story') {
      return node
    }
    if (node.type === 'directory' && node.children) {
      const found = getFirstStory(node.children)
      if (found) return found
    }
  }
  return null
}

/**
 * Get the first story from a specific directory
 */
export function getFirstStoryInDirectory(directory: StorybookFileTree): StorybookFileTree | null {
  if (directory.type !== 'directory' || !directory.children) {
    return null
  }
  return getFirstStory(directory.children)
}

/**
 * Build breadcrumb path segments for a story
 */
export function getStoryBreadcrumbs(
  story: StorybookFileTree,
): { name: string; path: string; storyId?: string }[] {
  const parts = story.path.split('/')
  const result: { name: string; path: string; storyId?: string }[] = []

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i]
    if (!part) continue
    const path = parts.slice(0, i + 1).join('/')
    result.push({
      name: part,
      path,
      storyId: i === parts.length - 1 ? story.storyId || undefined : undefined,
    })
  }

  return result
}
