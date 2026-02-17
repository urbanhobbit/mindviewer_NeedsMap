/**
 * Parses a Freemind .mm file (XML string) into a JS object.
 * Returns the root node structure.
 */
export function parseFreemind(xmlString) {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlString, "text/xml");

    const mapElement = xmlDoc.getElementsByTagName("map")[0];
    if (!mapElement) {
        throw new Error("Invalid Freemind file: No <map> element found.");
    }

    // Find the root node (first <node> inside <map>)
    // Often Freemind has nested <node> but usually one root inside map.
    let rootNode = null;
    for (let i = 0; i < mapElement.childNodes.length; i++) {
        if (mapElement.childNodes[i].nodeName === "node") {
            rootNode = mapElement.childNodes[i];
            break;
        }
    }

    if (!rootNode) throw new Error("No root node found within <map>.");

    return parseNode(rootNode);
}

function parseNode(xmlNode) {
    const customId = () => Math.random().toString(36).substr(2, 9);

    const nodeData = {
        id: xmlNode.getAttribute("ID") || customId(),
        text: xmlNode.getAttribute("TEXT") || "",
        folded: xmlNode.getAttribute("FOLDED") === "true",
        icon: null,
        link: xmlNode.getAttribute("LINK"),
        style: {},
        children: [], // Left/Right children could be separated if POSITION is used, but for now flat list
        position: xmlNode.getAttribute("POSITION") // 'left' or 'right'
    };

    // Extract style attributes
    if (xmlNode.getAttribute("COLOR")) {
        nodeData.style.color = xmlNode.getAttribute("COLOR");
    }
    if (xmlNode.getAttribute("BACKGROUND_COLOR")) {
        nodeData.style.backgroundColor = xmlNode.getAttribute("BACKGROUND_COLOR");
    }

    // Iterate children
    for (let i = 0; i < xmlNode.childNodes.length; i++) {
        const child = xmlNode.childNodes[i];
        if (child.nodeName === "node") {
            nodeData.children.push(parseNode(child));
        } else if (child.nodeName === "icon") {
            nodeData.icon = child.getAttribute("BUILTIN");
        } else if (child.nodeName === "font") {
            nodeData.style.fontFamily = child.getAttribute("NAME");
            nodeData.style.fontSize = child.getAttribute("SIZE");
            if (child.getAttribute("BOLD") === "true") nodeData.style.fontWeight = "bold";
            if (child.getAttribute("ITALIC") === "true") nodeData.style.fontStyle = "italic";
        }
    }

    return nodeData;
}
