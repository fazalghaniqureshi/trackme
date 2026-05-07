import { Fragment, useState } from "react";
interface ListGroupProps {
  items: string[];
  heading: string;
  onSelectItem: (item: string) => void;
}

function ListGroup(props: ListGroupProps) {
  // const items = ["Item 1", "Item 2", "Item 3"];
  const [selectedIndex, setSelectedIndex] = useState(-1); // array destructuring

  return (
    <Fragment>
      <h1>{props.heading}</h1>
      {props.items.length === 0 ? (
        <div className="alert alert-warning">No items found</div>
      ) : (
        <ul className="list-group">
          {props.items.map((item, index) => (
            <li
              key={index}
              className={
                selectedIndex === index
                  ? "list-group-item active"
                  : "list-group-item"
              }
              onClick={() => {
                setSelectedIndex(index);
                props.onSelectItem(item);
              }}
            >
              {item}
            </li>
          ))}
        </ul>
      )}
    </Fragment>
  );
}

export default ListGroup;
// This component is a placeholder for the list group functionality.
