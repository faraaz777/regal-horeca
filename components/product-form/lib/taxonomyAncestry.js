/**
 * Walk a category/brand tree to the root so cascade dropdowns can hydrate
 * from a single saved leaf id (categoryId / brandCategoryId).
 */

function getNodeAncestry(nodeId, nodes) {
  const ancestry = {};
  let current = nodes.find((n) => {
    const id = n._id || n.id;
    return id?.toString() === nodeId?.toString();
  });

  while (current) {
    ancestry[current.level] = current._id || current.id;
    const parentId = current.parent?._id || current.parent;
    if (parentId) {
      current = nodes.find((n) => {
        const id = n._id || n.id;
        return id?.toString() === parentId.toString();
      });
    } else {
      break;
    }
  }
  return ancestry;
}

export function getCategoryAncestry(categoryId, categories) {
  return getNodeAncestry(categoryId, categories);
}

export function getBrandAncestry(brandId, brands) {
  return getNodeAncestry(brandId, brands);
}

export function getChildrenByParent(nodes, parentId) {
  if (!parentId) {
    return (nodes || []).filter((n) => {
      const parent = n.parent?._id || n.parent;
      return !parent;
    });
  }
  return (nodes || []).filter((n) => {
    const parent = n.parent?._id || n.parent;
    return parent?.toString() === parentId.toString();
  });
}
