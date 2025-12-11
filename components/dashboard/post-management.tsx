"use client"

/*
 * PALIWANAG NG POST MANAGEMENT SYSTEM:
 * 
 * Ang component na ito ay ginagamit para sa pamamahala ng mga evaluation posts:
 * 1. Paglikha ng bagong evaluation post para sa mga guro
 * 2. Pag-edit ng mga detalye ng evaluation post
 * 3. Pagtanggal ng evaluation post
 * 4. Pagpapakita ng listahan ng lahat ng posts
 * 
 * MAHAHALAGANG FEATURES:
 * - Pag-uugnay ng post sa isang specific na guro
 * - Validation ng forms bago mag-save
 * - Real-time na pag-update ng listahan
 * - Pag-iingat sa pag-delete (may confirmation)
 */

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Card, CardContent, CardDescription, CardTitle } from "@/components/ui/card"
import { Plus, Edit, Trash2, FileText, User } from "lucide-react"
import { postService } from "@/lib/database"
import type { Post, Professor } from "@/lib/types"

interface PostManagementProps {
  posts: Post[]
  professors: Professor[]
  onRefresh?: () => void
}

export function PostManagement({ posts, professors, onRefresh }: PostManagementProps) {
  // MGA ESTADO (STATES) NG COMPONENT:
  
  // Para sa mga dialog boxes
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false) // Pag-add ng bagong post
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false) // Pag-edit ng post
  const [editingPost, setEditingPost] = useState<Post | null>(null) // Current na ine-edit na post

  // MGA ESTADO NG FORM
  const [selectedTeacherId, setSelectedTeacherId] = useState("") // Napiling guro
  const [title, setTitle] = useState("") // Titulo ng evaluation
  const [description, setDescription] = useState("") // Deskripsyon

  // FUNCTION PARA SA PAGDAGDAG NG BAGONG POST
  const handleAddPost = async () => {
    // Check kung may napiling guro at may title
    if (!selectedTeacherId || !title.trim()) return

    try {
      // Ilalagay sa database ang bagong post
      await postService.create(title.trim(), description.trim(), selectedTeacherId)
      
      // I-reset ang form at isara ang dialog
      resetForm()
      setIsAddDialogOpen(false)
      
      // I-refresh ang listahan ng posts
      onRefresh?.()
    } catch (error) {
      console.error("Error adding post:", error)
      alert("Error adding post. Please try again.")
    }
  }

  // FUNCTION PARA SA PAG-EDIT NG POST
  const handleEditPost = async () => {
    // Check kung may valid na post at title
    if (!editingPost || !title.trim()) return

    try {
      // I-update ang post sa database
      await postService.update(editingPost.id, title.trim(), description.trim())
      
      // I-reset ang form at isara ang dialog
      resetForm()
      setIsEditDialogOpen(false)
      setEditingPost(null)
      
      // I-refresh ang listahan
      onRefresh?.()
    } catch (error) {
      console.error("Error updating post:", error)
      alert("Error updating post. Please try again.")
    }
  }

  // FUNCTION PARA SA PAG-DELETE NG POST
  const handleDeletePost = async (postId: string) => {
    try {
      // Tanggalin ang post sa database
      await postService.delete(postId)
      
      // I-refresh ang listahan
      onRefresh?.()
      
      alert("Post successfully deleted!")
    } catch (error) {
      console.error("Error deleting post:", error)
      alert("Failed to delete post. An error occurred.")
    }
  }

  // FUNCTION PARA BUKSAN ANG EDIT DIALOG
  const openEditDialog = (post: Post) => {
    // I-save ang kasalukuyang datos ng post
    setEditingPost(post)
    
    // I-populate ang form ng current values
    setSelectedTeacherId(post.teacherId)
    setTitle(post.title)
    setDescription(post.description || "")
    
    // Buksan ang edit dialog
    setIsEditDialogOpen(true)
  }

  // FUNCTION PARA I-RESET ANG FORM
  const resetForm = () => {
    // I-clear lahat ng fields
    setSelectedTeacherId("")
    setTitle("")
    setDescription("")
    setEditingPost(null)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-foreground">Post Management</h2>
          <p className="text-muted-foreground">Create and manage evaluation posts for teachers</p>
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={resetForm}>
              <Plus className="mr-2 h-4 w-4" />
              Add Post
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Add New Post</DialogTitle>
              <DialogDescription>Create a new evaluation post for a teacher.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="teacher">Select Teacher</Label>
                <Select value={selectedTeacherId} onValueChange={setSelectedTeacherId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a teacher" />
                  </SelectTrigger>
                  <SelectContent>
                    {professors.map((professor) => (
                      <SelectItem key={professor.id} value={professor.id}>
                        {professor.name} - {professor.departmentName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="title">Post Title</Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Communication Skills Evaluation"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="description">Description (Optional)</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Questions about teacher communication and interaction with students"
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleAddPost} disabled={!selectedTeacherId || !title.trim()}>
                Add Post
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats Card */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between pb-2 border-b border-border mb-4">
            <div className="flex items-center gap-2">
              <CardTitle className="text-sm font-medium">Total Posts</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </div>
          </div>
          <div className="text-2xl font-bold">{posts.length}</div>
          <p className="text-xs text-muted-foreground">Evaluation posts created</p>
        </CardContent>
      </Card>

      {/* Posts Table */}
      <Card>
        <CardContent className="pt-6">
          <div className="pb-4 border-b border-border mb-6">
            <CardTitle>Posts ({posts.length})</CardTitle>
            <CardDescription>Manage evaluation posts and their associated teachers</CardDescription>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Teacher</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {posts.map((post) => (
                <TableRow key={post.id}>
                  <TableCell className="font-medium">{post.title}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-muted-foreground" />
                      {post.teacherName}
                    </div>
                  </TableCell>
                  <TableCell className="max-w-xs truncate">{post.description || "No description"}</TableCell>
                  <TableCell>{post.createdAt.toLocaleDateString()}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" size="sm" onClick={() => openEditDialog(post)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="outline" size="sm">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Post</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to delete this post? This will also delete all associated questions.
                              This action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleDeletePost(post.id)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {posts.length === 0 && (
            <div className="text-center py-8">
              <p className="text-muted-foreground">No posts found. Add your first evaluation post to get started.</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Post</DialogTitle>
            <DialogDescription>Update post information.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="edit-title">Post Title</Label>
              <Input id="edit-title" value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="edit-description">Description (Optional)</Label>
              <Textarea
                id="edit-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleEditPost} disabled={!title.trim()}>
              Update Post
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
