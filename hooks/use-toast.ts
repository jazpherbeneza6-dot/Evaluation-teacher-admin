/*
 * TOAST NOTIFICATION HOOK - Ito ang hook para sa pag-manage ng toast notifications
 * 
 * SIMPLE EXPLANATION:
 * 1. Ginagamit ito para sa pag-show ng mga notification messages
 * 2. Pwede kang mag-add, update, dismiss, at remove ng toasts
 * 3. May automatic na pag-remove ng toasts after ilang seconds
 * 4. May limit din kung ilang toasts ang pwedeng i-show at once
 * 
 * MGA FEATURES:
 * - Add/Update/Dismiss/Remove toasts
 * - Automatic removal after delay
 * - Toast limit management
 * - Real-time state updates
 */

"use client"

// Inspired by react-hot-toast library
import * as React from "react"

// STEP 1: Import ng mga kailangan na types
import type {
  ToastActionElement,
  ToastProps,
} from "@/components/ui/toast"

// STEP 2: Constants para sa toast configuration
const TOAST_LIMIT = 1 // Maximum number ng toasts na pwedeng i-show
const TOAST_REMOVE_DELAY = 1000000 // Delay bago i-remove ang toast (in milliseconds)

// STEP 3: Define ang ToasterToast type - structure ng toast
type ToasterToast = ToastProps & {
  id: string // Unique ID ng toast
  title?: React.ReactNode // Title ng toast
  description?: React.ReactNode // Description ng toast
  action?: ToastActionElement // Action button ng toast
}

// STEP 4: Action types para sa toast management
const actionTypes = {
  ADD_TOAST: "ADD_TOAST", // Para sa pag-add ng toast
  UPDATE_TOAST: "UPDATE_TOAST", // Para sa pag-update ng toast
  DISMISS_TOAST: "DISMISS_TOAST", // Para sa pag-dismiss ng toast
  REMOVE_TOAST: "REMOVE_TOAST", // Para sa pag-remove ng toast
} as const

let count = 0 // Counter para sa pag-generate ng unique IDs

// STEP 5: Function para sa pag-generate ng unique ID
function genId() {
  count = (count + 1) % Number.MAX_SAFE_INTEGER // I-increment ang counter
  return count.toString() // I-convert sa string
}

// STEP 6: Define ang ActionType at Action types
type ActionType = typeof actionTypes

// Action union type - lahat ng possible actions
type Action =
  | {
      type: ActionType["ADD_TOAST"] // Add toast action
      toast: ToasterToast // Toast object na i-add
    }
  | {
      type: ActionType["UPDATE_TOAST"] // Update toast action
      toast: Partial<ToasterToast> // Partial toast object na i-update
    }
  | {
      type: ActionType["DISMISS_TOAST"] // Dismiss toast action
      toastId?: ToasterToast["id"] // ID ng toast na i-dismiss (optional)
    }
  | {
      type: ActionType["REMOVE_TOAST"] // Remove toast action
      toastId?: ToasterToast["id"] // ID ng toast na i-remove (optional)
    }

// STEP 7: State interface - structure ng toast state
interface State {
  toasts: ToasterToast[] // Array ng mga toasts
}

// STEP 8: Toast timeout management
const toastTimeouts = new Map<string, ReturnType<typeof setTimeout>>() // Map para sa toast timeouts

// Function para sa pag-add ng toast sa remove queue
const addToRemoveQueue = (toastId: string) => {
  if (toastTimeouts.has(toastId)) {
    return // Kung may existing timeout na, hindi na mag-add
  }

  // I-create ang timeout para sa pag-remove ng toast
  const timeout = setTimeout(() => {
    toastTimeouts.delete(toastId) // I-delete ang timeout sa map
    dispatch({
      type: "REMOVE_TOAST", // I-dispatch ang remove action
      toastId: toastId,
    })
  }, TOAST_REMOVE_DELAY) // After ng TOAST_REMOVE_DELAY

  toastTimeouts.set(toastId, timeout) // I-save ang timeout sa map
}

// STEP 9: Reducer function - para sa pag-manage ng toast state
export const reducer = (state: State, action: Action): State => {
  switch (action.type) {
    case "ADD_TOAST":
      // I-add ang bagong toast sa beginning ng array at i-limit sa TOAST_LIMIT
      return {
        ...state,
        toasts: [action.toast, ...state.toasts].slice(0, TOAST_LIMIT),
      }

    case "UPDATE_TOAST":
      // I-update ang existing toast base sa ID
      return {
        ...state,
        toasts: state.toasts.map((t) =>
          t.id === action.toast.id ? { ...t, ...action.toast } : t
        ),
      }

    case "DISMISS_TOAST": {
      const { toastId } = action

      // ! Side effects ! - This could be extracted into a dismissToast() action,
      // but I'll keep it here for simplicity
      if (toastId) {
        addToRemoveQueue(toastId) // I-add sa remove queue kung may specific toastId
      } else {
        state.toasts.forEach((toast) => {
          addToRemoveQueue(toast.id) // I-add lahat ng toasts sa remove queue
        })
      }

      // I-set ang open property sa false para sa dismissed toasts
      return {
        ...state,
        toasts: state.toasts.map((t) =>
          t.id === toastId || toastId === undefined
            ? {
                ...t,
                open: false,
              }
            : t
        ),
      }
    }
    case "REMOVE_TOAST":
      // I-remove ang toast sa array
      if (action.toastId === undefined) {
        return {
          ...state,
          toasts: [], // I-clear lahat ng toasts kung walang specific toastId
        }
      }
      return {
        ...state,
        toasts: state.toasts.filter((t) => t.id !== action.toastId), // I-remove ang specific toast
      }
  }
}

// STEP 10: State management
const listeners: Array<(state: State) => void> = [] // Array ng listeners para sa state changes
let memoryState: State = { toasts: [] } // Memory state para sa toasts

// Function para sa pag-dispatch ng actions
function dispatch(action: Action) {
  memoryState = reducer(memoryState, action) // I-update ang state gamit ang reducer
  listeners.forEach((listener) => {
    listener(memoryState) // I-notify ang lahat ng listeners
  })
}

// STEP 11: Toast type - ToasterToast without id
type Toast = Omit<ToasterToast, "id">

// Function para sa pag-create ng toast
function toast({ ...props }: Toast) {
  const id = genId() // I-generate ang unique ID

  // Function para sa pag-update ng toast
  const update = (props: ToasterToast) =>
    dispatch({
      type: "UPDATE_TOAST",
      toast: { ...props, id },
    })
  
  // Function para sa pag-dismiss ng toast
  const dismiss = () => dispatch({ type: "DISMISS_TOAST", toastId: id })

  // I-dispatch ang ADD_TOAST action
  dispatch({
    type: "ADD_TOAST",
    toast: {
      ...props,
      id,
      open: true,
      onOpenChange: (open) => {
        if (!open) dismiss() // I-dismiss kung mag-close
      },
    },
  })

  return {
    id: id, // I-return ang ID
    dismiss, // I-return ang dismiss function
    update, // I-return ang update function
  }
}

// STEP 12: useToast hook - para sa pag-access ng toast functionality
function useToast() {
  const [state, setState] = React.useState<State>(memoryState) // State para sa toasts

  React.useEffect(() => {
    listeners.push(setState) // I-add ang setState sa listeners
    return () => {
      const index = listeners.indexOf(setState)
      if (index > -1) {
        listeners.splice(index, 1) // I-remove ang setState sa listeners kapag mag-unmount
      }
    }
  }, [state])

  return {
    ...state, // I-spread ang state
    toast, // I-return ang toast function
    dismiss: (toastId?: string) => dispatch({ type: "DISMISS_TOAST", toastId }), // I-return ang dismiss function
  }
}

// STEP 13: Export ang useToast hook at toast function
export { useToast, toast }
