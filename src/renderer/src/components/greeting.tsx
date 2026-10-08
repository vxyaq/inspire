import { useMemo, useState, useEffect } from "react"
import { invoke } from "@/lib/electron"

function Greeting() {
  const [name, setName] = useState("")

  useEffect(() => {
    localStorage.removeItem("inspire:user")
    const loadName = () => {
      invoke({ channel: "auth:get-session" })
        .then((account) => {
          setName(account?.displayName || "")
        })
        .catch((err) => {
          console.error("Error fetching account name:", err)
        })
    }

    loadName()
    window.addEventListener("auth:changed", loadName)
    return () => window.removeEventListener("auth:changed", loadName)
  }, [])

  const generalGreetings = [
    "Hi",
    "Hello",
    "Hey",
    "Greetings",
    "Yo",
    "Howdy",
    "What's up",
    "Good to see you",
    "Welcome Back",
    "Ahoy",
  ]

  const timeGreetings = () => {
    const hour = new Date().getHours()
    if (hour < 12) return ["Good morning"]
    if (hour < 18) return ["Good afternoon"]
    return ["Good evening"]
  }

  const randomGreeting = useMemo(() => {
    const allGreetings = [...generalGreetings, ...timeGreetings()]
    return allGreetings[Math.floor(Math.random() * allGreetings.length)]
  }, [])

  return (
    <h1 className="text-2xl font-bold mb-4">
      {randomGreeting},{" "}
      <span className="text-inspire-primary">{name || "friend"}</span>
    </h1>
  )
}

export default Greeting
