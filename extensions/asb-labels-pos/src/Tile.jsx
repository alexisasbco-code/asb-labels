import "@shopify/ui-extensions/preact";
import {render} from 'preact';

export default async () => {
  render(<Tile />, document.body);
};

function Tile() {
  // Opens the label reprint tool: scan an item, print N labels to the Zebra.
  return (
    <s-tile
      heading="Print Label"
      subheading="Scan item → Zebra"
      onClick={() => shopify.action.presentModal()}
    />
  );
}
