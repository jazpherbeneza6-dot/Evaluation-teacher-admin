"use client"

import { useState, useEffect } from "react"
import { useAuth } from "@/hooks/use-auth"
import { adminSettingsService } from "@/lib/database"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { User, RefreshCw, Lock, KeyRound } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { auth } from "@/lib/firebase"

export function SettingsManagement() {
  const { user } = useAuth()
  const { toast } = useToast()
  
  const [username, setUsername] = useState(user?.displayName || "System Administrator")
  
  // Dialog states
  const [isProfileDialogOpen, setIsProfileDialogOpen] = useState(false)
  const [isPassDialogOpen, setIsPassDialogOpen] = useState(false)
  const [isQuestionPassDialogOpen, setIsQuestionPassDialogOpen] = useState(false)
  
  // Input states for verification and updates
  const [currentValue, setCurrentValue] = useState("")
  const [newValue, setNewValue] = useState("")
  const [confirmValue, setConfirmValue] = useState("")
  const [isProcessing, setIsProcessing] = useState(false)

  // Sync with user data on mount
  useEffect(() => {
    if (user) {
      setUsername(user.displayName || "System Administrator")
    }
  }, [user])

  const resetDialogStates = () => {
    setCurrentValue("")
    setNewValue("")
    setConfirmValue("")
    setIsProcessing(false)
  }

  const handleUpdateProfile = async () => {
    if (!newValue.trim()) {
      toast({ title: "Required", description: "Username cannot be empty.", variant: "destructive" })
      return
    }

    try {
      setIsProcessing(true)
      
      const [adminProfile, storedPassword] = await Promise.all([
        adminSettingsService.getAdminProfile(),
        adminSettingsService.getAdminPassword()
      ])
      
      if (currentValue !== storedPassword) {
        toast({ title: "Verification Failed", description: "Incorrect current password.", variant: "destructive" })
        setIsProcessing(false)
        return
      }

      await adminSettingsService.updateAdminProfile({
        username: newValue.trim()
      })
      
      toast({ title: "Profile Updated", description: "Your username has been changed." })
      setIsProfileDialogOpen(false)
      resetDialogStates()
    } catch (error) {
      toast({ title: "Update Failed", description: "Could not save profile.", variant: "destructive" })
    } finally {
      setIsProcessing(false)
    }
  }

  const handleUpdatePassword = async () => {
    if (newValue !== confirmValue) {
      toast({ title: "Match Error", description: "Passwords do not match.", variant: "destructive" })
      return
    }
    if (newValue.length < 4) {
      toast({ title: "Security Info", description: "Password must be at least 4 characters.", variant: "destructive" })
      return
    }

    try {
      setIsProcessing(true)
      
      const storedPassword = await adminSettingsService.getAdminPassword()
      
      if (currentValue !== storedPassword) {
        toast({ title: "Verification Failed", description: "Incorrect current password.", variant: "destructive" })
        setIsProcessing(false)
        return
      }

      await adminSettingsService.updateAdminPassword(newValue)
      
      toast({ title: "Password Updated", description: "Your account password has been changed." })
      setIsPassDialogOpen(false)
      resetDialogStates()
    } catch (error) {
      toast({ title: "Error", description: "An unexpected error occurred.", variant: "destructive" })
    } finally {
      setIsProcessing(false)
    }
  }

  const handleUpdateQuestionPassword = async () => {
    if (newValue !== confirmValue) {
      toast({ title: "Match Error", description: "Passwords do not match.", variant: "destructive" })
      return
    }
    if (newValue.length < 4) {
      toast({ title: "Security Info", description: "Password must be at least 4 characters.", variant: "destructive" })
      return
    }

    try {
      setIsProcessing(true)
      
      const isVerified = await adminSettingsService.verifyQuestionPassword(currentValue)
      
      if (!isVerified) {
        toast({ title: "Verification Failed", description: "Incorrect current question password.", variant: "destructive" })
        setIsProcessing(false)
        return
      }

      await adminSettingsService.updateQuestionPassword(newValue)
      
      toast({ title: "Question Password Updated", description: "Security password for destructive actions changed." })
      setIsQuestionPassDialogOpen(false)
      resetDialogStates()
    } catch (error) {
      toast({ title: "Error", description: "An unexpected error occurred.", variant: "destructive" })
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Settings</h2>
          <p className="text-muted-foreground">
            Manage your account security and profile settings.
          </p>
        </div>
      </div>

      <Tabs defaultValue="account" className="w-full">
        <TabsList className="grid w-full grid-cols-1 lg:w-[200px]">
          <TabsTrigger value="account">Account</TabsTrigger>
        </TabsList>

        <TabsContent value="account" className="space-y-4 mt-6">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <Card className="shadow-sm border-blue-100 overflow-hidden group">
              <div className="h-1 institutional-gradient w-full" />
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <User className="h-5 w-5 text-blue-600" />
                  Profile Settings
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-4 border rounded-xl bg-background/50 flex flex-col items-center text-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center">
                    <User className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-sm line-clamp-1">{username}</h4>
                    <p className="text-[10px] text-muted-foreground mt-1 uppercase tracking-wider italic">Administrator</p>
                  </div>
                  <Button variant="outline" size="sm" className="w-full mt-2" onClick={() => { resetDialogStates(); setNewValue(username); setIsProfileDialogOpen(true); }}>
                    Change Username
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-sm border-primary-100 overflow-hidden group">
              <div className="h-1 bg-primary w-full" />
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Lock className="h-5 w-5 text-primary" />
                  Account Password
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-4 border rounded-xl bg-background/50 flex flex-col items-center text-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <Lock className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-sm">Security Code</h4>
                    <p className="text-[10px] text-muted-foreground mt-1 uppercase tracking-wider">Login Access</p>
                  </div>
                  <Button variant="outline" size="sm" className="w-full mt-2" onClick={() => { resetDialogStates(); setIsPassDialogOpen(true); }}>
                    Update Password
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-sm border-amber-100 overflow-hidden group">
              <div className="h-1 bg-amber-500 w-full" />
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <KeyRound className="h-5 w-5 text-amber-500" />
                  Question Password
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-4 border rounded-xl bg-background/50 flex flex-col items-center text-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-amber-500/10 flex items-center justify-center">
                    <KeyRound className="h-5 w-5 text-amber-500" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-sm">Action Code</h4>
                    <p className="text-[10px] text-muted-foreground mt-1 uppercase tracking-wider">Destructive Actions</p>
                  </div>
                  <Button variant="outline" size="sm" className="w-full mt-2" onClick={() => { resetDialogStates(); setIsQuestionPassDialogOpen(true); }}>
                    Change Action Code
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

      </Tabs>

      {/* Update Profile Dialog */}
      <Dialog open={isProfileDialogOpen} onOpenChange={setIsProfileDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Update Profile</DialogTitle>
            <DialogDescription>
              Update your administrative username. Verification required.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="curr-pass-u">Current Password</Label>
              <Input id="curr-pass-u" type="password" value={currentValue} onChange={(e) => setCurrentValue(e.target.value)} />
            </div>
            <div className="grid gap-2 border-t pt-4">
              <Label htmlFor="new-user">New Username</Label>
              <Input id="new-user" value={newValue} onChange={(e) => setNewValue(e.target.value)} placeholder="e.g. Principal Admin" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsProfileDialogOpen(false)}>Cancel</Button>
            <Button className="institutional-gradient text-white" onClick={handleUpdateProfile} disabled={isProcessing}>
              {isProcessing && <RefreshCw className="mr-2 h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Update Password Dialog */}
      <Dialog open={isPassDialogOpen} onOpenChange={setIsPassDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Change Account Password</DialogTitle>
            <DialogDescription>
              Update the password used for logging into this admin dashboard.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="curr-pass">Current Password</Label>
              <Input id="curr-pass" type="password" value={currentValue} onChange={(e) => setCurrentValue(e.target.value)} />
            </div>
            <div className="grid gap-2 border-t pt-4">
              <Label htmlFor="new-pass">New Password</Label>
              <Input id="new-pass" type="password" value={newValue} onChange={(e) => setNewValue(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="conf-pass">Confirm New Password</Label>
              <Input id="conf-pass" type="password" value={confirmValue} onChange={(e) => setConfirmValue(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsPassDialogOpen(false)}>Cancel</Button>
            <Button className="institutional-gradient text-white" onClick={handleUpdatePassword} disabled={isProcessing}>
              {isProcessing && <RefreshCw className="mr-2 h-4 w-4 animate-spin" />}
              Update Password
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Update Question Password Dialog */}
      <Dialog open={isQuestionPassDialogOpen} onOpenChange={setIsQuestionPassDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Change Question Password</DialogTitle>
            <DialogDescription>
              Update the security password required for deleting questions or evaluations.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="curr-q-pass">Current Question Password</Label>
              <Input id="curr-q-pass" type="password" value={currentValue} onChange={(e) => setCurrentValue(e.target.value)} />
            </div>
            <div className="grid gap-2 border-t pt-4">
              <Label htmlFor="new-q-pass">New Question Password</Label>
              <Input id="new-q-pass" type="password" value={newValue} onChange={(e) => setNewValue(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="conf-q-pass">Confirm New Question Password</Label>
              <Input id="conf-q-pass" type="password" value={confirmValue} onChange={(e) => setConfirmValue(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsQuestionPassDialogOpen(false)}>Cancel</Button>
            <Button className="institutional-gradient text-white" onClick={handleUpdateQuestionPassword} disabled={isProcessing}>
              {isProcessing && <RefreshCw className="mr-2 h-4 w-4 animate-spin" />}
              Update Question Password
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
