import { Node } from "@tiptap/core"

export const LinkCard = Node.create({
  name: "linkCard",

  group: "block",

  atom: true,

  addAttributes() {
    return {
      url: {
        default: null,
      },
    }
  },

  parseHTML() {
    return [
      {
        tag: "link-card",
      },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    return ["link-card", HTMLAttributes, 0]
  },

  addNodeView() {
    return ({ node }) => {

      const container = document.createElement("div")
      container.contentEditable = "false"

      container.className =
        "border rounded-lg flex items-center overflow-hidden shadow-sm hover:bg-gray-50 cursor-pointer my-3"

      const thumbnail = document.createElement("div")
      thumbnail.className = "w-40 h-24 bg-gray-200 flex items-center justify-center"

      thumbnail.innerHTML = `
        <span class="text-gray-400 text-xl">...</span>
      `

      const info = document.createElement("div")
      info.className = "p-3"

      const title = document.createElement("div")
      title.className = "text-sm font-medium"
      title.innerText = node.attrs.url

      let domain = node.attrs.url

      try {
        domain = new URL(node.attrs.url).hostname
      } catch {}

      const domainEl = document.createElement("div")
      domainEl.className = "text-xs text-gray-500"
      domainEl.innerText = domain

      info.appendChild(title)
      info.appendChild(domainEl)

      container.appendChild(thumbnail)
      container.appendChild(info)

      container.onclick = () => {
        window.open(node.attrs.url, "_blank")
      }

      return {
        dom: container,
      }
    }
  },
})