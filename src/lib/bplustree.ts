/**
 * B+ Tree Implementation
 * 
 * B+ Tree characteristics:
 * - All data stored in leaf nodes
 * - Internal nodes only store index keys
 * - Leaf nodes connected via linked list
 * - Optimized for range queries and sequential access
 */

export interface BPlusTreeNode<K, V> {
  id: number;
  keys: K[];
  isLeaf: boolean;
  // Leaf nodes: values store actual data
  // Internal nodes: children store child node references
  values?: V[];
  children?: BPlusTreeNode<K, V>[];
  // Linked list pointer for leaf nodes
  next?: BPlusTreeNode<K, V>;
  parent?: BPlusTreeNode<K, V>;
}

export interface TreeStats {
  totalNodes: number;
  leafNodes: number;
  internalNodes: number;
  height: number;
  totalKeys: number;
  minKeysPerLeaf: number;
  maxKeysPerLeaf: number;
  avgKeysPerLeaf: number;
}

export interface NodeDistribution {
  nodeId: number;
  keyCount: number;
  isLeaf: boolean;
  depth: number;
  keys: string[]; // String representation of first few keys
}

let nodeIdCounter = 0;

export class BPlusTree<K, V> {
  private root: BPlusTreeNode<K, V>;
  private order: number; // Maximum number of children
  private compare: (a: K, b: K) => number;

  constructor(
    order: number = 4,
    compare: (a: K, b: K) => number = (a, b) => {
      if (a < b) return -1;
      if (a > b) return 1;
      return 0;
    }
  ) {
    this.order = Math.max(3, order); // Minimum order is 3
    this.compare = compare;
    this.root = this.createLeafNode();
  }

  private createLeafNode(): BPlusTreeNode<K, V> {
    return {
      id: nodeIdCounter++,
      keys: [],
      isLeaf: true,
      values: [],
    };
  }

  private createInternalNode(): BPlusTreeNode<K, V> {
    return {
      id: nodeIdCounter++,
      keys: [],
      isLeaf: false,
      children: [],
    };
  }

  /**
   * Insert key-value pair
   */
  insert(key: K, value: V): void {
    const leaf = this.findLeaf(key);
    this.insertIntoLeaf(leaf, key, value);

    // Split if leaf is full
    if (leaf.keys.length >= this.order) {
      this.splitLeaf(leaf);
    }
  }

  /**
   * Batch insert
   */
  insertBatch(entries: { key: K; value: V }[]): void {
    for (const { key, value } of entries) {
      this.insert(key, value);
    }
  }

  /**
   * Find value for key
   */
  find(key: K): V | undefined {
    const leaf = this.findLeaf(key);
    const index = this.findKeyIndex(leaf.keys, key);
    
    if (index < leaf.keys.length && this.compare(leaf.keys[index], key) === 0) {
      return leaf.values![index];
    }
    return undefined;
  }

  /**
   * Range query
   */
  range(startKey: K, endKey: K): { key: K; value: V }[] {
    const results: { key: K; value: V }[] = [];
    let leaf: BPlusTreeNode<K, V> | undefined = this.findLeaf(startKey);

    while (leaf) {
      for (let i = 0; i < leaf.keys.length; i++) {
        const key = leaf.keys[i];
        if (this.compare(key, startKey) >= 0 && this.compare(key, endKey) <= 0) {
          results.push({ key, value: leaf.values![i] });
        } else if (this.compare(key, endKey) > 0) {
          return results;
        }
      }
      leaf = leaf.next;
    }

    return results;
  }

  /**
   * Get all leaf nodes (for visualization)
   */
  getAllLeaves(): BPlusTreeNode<K, V>[] {
    const leaves: BPlusTreeNode<K, V>[] = [];
    let leaf = this.getFirstLeaf();
    
    while (leaf) {
      leaves.push(leaf);
      leaf = leaf.next;
    }
    
    return leaves;
  }

  /**
   * Get tree statistics
   */
  getStats(): TreeStats {
    const leaves = this.getAllLeaves();
    const allNodes = this.getAllNodes();
    const leafNodes = leaves.length;
    const internalNodes = allNodes.length - leafNodes;
    const totalKeys = leaves.reduce((sum, leaf) => sum + leaf.keys.length, 0);
    
    const keysPerLeaf = leaves.map(l => l.keys.length);
    
    return {
      totalNodes: allNodes.length,
      leafNodes,
      internalNodes,
      height: this.getHeight(),
      totalKeys,
      minKeysPerLeaf: keysPerLeaf.length > 0 ? Math.min(...keysPerLeaf) : 0,
      maxKeysPerLeaf: keysPerLeaf.length > 0 ? Math.max(...keysPerLeaf) : 0,
      avgKeysPerLeaf: leafNodes > 0 ? totalKeys / leafNodes : 0,
    };
  }

  /**
   * Get node distribution info (for visualization)
   */
  getNodeDistribution(): NodeDistribution[] {
    const distribution: NodeDistribution[] = [];
    
    const traverse = (node: BPlusTreeNode<K, V>, depth: number) => {
      distribution.push({
        nodeId: node.id,
        keyCount: node.keys.length,
        isLeaf: node.isLeaf,
        depth,
        keys: node.keys.slice(0, 3).map(k => String(k)),
      });
      
      if (!node.isLeaf && node.children) {
        for (const child of node.children) {
          traverse(child, depth + 1);
        }
      }
    };
    
    traverse(this.root, 0);
    return distribution;
  }

  /**
   * Get tree structure (for visualization)
   */
  getTreeStructure(): BPlusTreeNode<K, V> {
    return this.root;
  }

  /**
   * Get nodes organized by level (for visualization)
   */
  getLevelOrder(): BPlusTreeNode<K, V>[][] {
    const levels: BPlusTreeNode<K, V>[][] = [];
    let currentLevel = [this.root];
    
    while (currentLevel.length > 0) {
      levels.push(currentLevel);
      const nextLevel: BPlusTreeNode<K, V>[] = [];
      
      for (const node of currentLevel) {
        if (!node.isLeaf && node.children) {
          nextLevel.push(...node.children);
        }
      }
      
      currentLevel = nextLevel;
    }
    
    return levels;
  }

  private findLeaf(key: K): BPlusTreeNode<K, V> {
    let node = this.root;
    
    while (!node.isLeaf) {
      let i = 0;
      while (i < node.keys.length && this.compare(key, node.keys[i]) >= 0) {
        i++;
      }
      node = node.children![i];
    }
    
    return node;
  }

  private findKeyIndex(keys: K[], key: K): number {
    let low = 0;
    let high = keys.length;
    
    while (low < high) {
      const mid = Math.floor((low + high) / 2);
      if (this.compare(keys[mid], key) < 0) {
        low = mid + 1;
      } else {
        high = mid;
      }
    }
    
    return low;
  }

  private insertIntoLeaf(leaf: BPlusTreeNode<K, V>, key: K, value: V): void {
    const index = this.findKeyIndex(leaf.keys, key);
    
    // If key exists, update value
    if (index < leaf.keys.length && this.compare(leaf.keys[index], key) === 0) {
      leaf.values![index] = value;
      return;
    }
    
    // Insert new key-value pair
    leaf.keys.splice(index, 0, key);
    leaf.values!.splice(index, 0, value);
  }

  private splitLeaf(leaf: BPlusTreeNode<K, V>): void {
    const midIndex = Math.ceil(leaf.keys.length / 2);
    
    // Create new right leaf node
    const rightLeaf = this.createLeafNode();
    rightLeaf.keys = leaf.keys.splice(midIndex);
    rightLeaf.values = leaf.values!.splice(midIndex);
    
    // Maintain leaf linked list
    rightLeaf.next = leaf.next;
    leaf.next = rightLeaf;
    
    // Promote middle key to parent
    const promotedKey = rightLeaf.keys[0];
    this.insertIntoParent(leaf, promotedKey, rightLeaf);
  }

  private insertIntoParent(
    leftNode: BPlusTreeNode<K, V>,
    key: K,
    rightNode: BPlusTreeNode<K, V>
  ): void {
    if (!leftNode.parent) {
      // Create new root node
      const newRoot = this.createInternalNode();
      newRoot.keys = [key];
      newRoot.children = [leftNode, rightNode];
      leftNode.parent = newRoot;
      rightNode.parent = newRoot;
      this.root = newRoot;
      return;
    }
    
    const parent = leftNode.parent;
    const index = this.findKeyIndex(parent.keys, key);
    
    parent.keys.splice(index, 0, key);
    parent.children!.splice(index + 1, 0, rightNode);
    rightNode.parent = parent;
    
    // Split if parent is full
    if (parent.keys.length >= this.order) {
      this.splitInternal(parent);
    }
  }

  private splitInternal(node: BPlusTreeNode<K, V>): void {
    const midIndex = Math.floor(node.keys.length / 2);
    const promotedKey = node.keys[midIndex];
    
    // Create new right internal node
    const rightNode = this.createInternalNode();
    rightNode.keys = node.keys.splice(midIndex + 1);
    rightNode.children = node.children!.splice(midIndex + 1);
    
    // Remove promoted key
    node.keys.pop();
    
    // Update children's parent references
    for (const child of rightNode.children) {
      child.parent = rightNode;
    }
    
    // Promote middle key to parent
    this.insertIntoParent(node, promotedKey, rightNode);
  }

  private getFirstLeaf(): BPlusTreeNode<K, V> {
    let node = this.root;
    while (!node.isLeaf) {
      node = node.children![0];
    }
    return node;
  }

  private getAllNodes(): BPlusTreeNode<K, V>[] {
    const nodes: BPlusTreeNode<K, V>[] = [];
    
    const traverse = (node: BPlusTreeNode<K, V>) => {
      nodes.push(node);
      if (!node.isLeaf && node.children) {
        for (const child of node.children) {
          traverse(child);
        }
      }
    };
    
    traverse(this.root);
    return nodes;
  }

  private getHeight(): number {
    let height = 0;
    let node = this.root;
    
    while (node) {
      height++;
      if (node.isLeaf) break;
      node = node.children![0];
    }
    
    return height;
  }

  /**
   * Reset node ID counter (for testing)
   */
  static resetNodeIdCounter(): void {
    nodeIdCounter = 0;
  }
}

/**
 * Create B+ Tree for bigint keys
 */
export function createBigIntTree<V>(order: number = 4): BPlusTree<bigint, V> {
  return new BPlusTree<bigint, V>(order, (a, b) => {
    if (a < b) return -1;
    if (a > b) return 1;
    return 0;
  });
}
